// Copyright (c) 2016-2020 Association of Universities for Research in Astronomy, Inc. (AURA)
// For license information see LICENSE or https://opensource.org/licenses/BSD-3-Clause

package demo

import cats.implicits._
import gsp.math.geom.jts.interpreter._
import japgolly.scalajs.react.MonocleReact._
import japgolly.scalajs.react._
import japgolly.scalajs.react.vdom.html_<^._
import org.scalajs.dom.document
import org.scalajs.dom.raw.Element
import react.aladin._
import react.common._
import gsp.math._
import monocle.macros.GenLens
import monocle.Lens
import gpp.svgdotjs.svgdotjsSvgJs.mod.Svg

final case class AladinContainer(
  s:           Size,
  coordinates: Coordinates
) extends ReactProps[AladinContainer](AladinContainer.component) {
  val aladinCoordsStr: String = Coordinates.fromHmsDms.reverseGet(coordinates)
}

object AladinContainer {
  type Props = AladinContainer

  val AladinComp = Aladin.component

  val coordinates = GenLens[AladinContainer](_.coordinates)

  /**
    * On the state we keep the svg to avoid recalculations during panning
    */
  final case class State(svg: Option[Svg])

  implicit val propsReuse: Reusability[Props] =
    Reusability.by_== //by(p => (p.aladinCoordsStr, p.s.width.toDouble, p.s.height.toDouble))
  implicit val stateReuse = Reusability.always[State]

  object State {
    val Zero: State = State(None)

    val svg: Lens[State, Option[Svg]] = Lens[State, Option[Svg]](_.svg)(a => s => s.copy(svg = a))
  }

  class Backend($ : BackendScope[Props, State]) {
    // Create a mutable reference
    private val aladinRef = Ref.toScalaComponent(AladinComp)

    /**
      * Recalculate the svg, we keep it on the state for better performance
      *
      * @return
      */
    def initialSvgState: Callback =
      aladinRef.get
        .flatMapCB(_.backend.runOnAladinCB(v => updateSvgState(v.pixelScale)))
        .void

    /**
      * Recalculate svg and store it on state
      *
      * @param pixelScale
      * @return
      */
    def updateSvgState(pixelScale: PixelScale): CallbackTo[Svg] =
      CallbackTo
        .pure(
          visualization
            .shapesToSvg(GmosGeometry.shapes, GmosGeometry.pp, pixelScale, GmosGeometry.ScaleFactor)
        )
        .flatTap(svg => $.setStateL(State.svg)(svg.some))

    def renderVisualization(
      svgBase:    Svg,
      div:        Element,
      size:       => Size,
      pixelScale: => PixelScale
    ): Callback =
      $.props
        .map(AladinContainer.coordinates.get)
        .toCBO
        .flatMap(c => aladinRef.get.flatMapCB(_.backend.world2pix(c))) // calculate the offset
        .map {
          case Some((x: Double, y: Double)) =>
            // Delete any viz previously rendered
            val previous = Option(div.querySelector(".aladin-visualization"))
            previous.foreach(div.removeChild)
            val g = document.createElement("div")
            g.classList.add("aladin-visualization")
            visualization.geometryForAladin(svgBase,
                                            g,
                                            size,
                                            pixelScale,
                                            GmosGeometry.ScaleFactor,
                                            (x, y)
            )
            // Include visibility on the dom
            div.appendChild(g)
          case _ =>
        }
        .void

    def includeSvg(v: JsAladin): Callback =
      v.onFullScreenToggle(recalculateView) *> // re render on screen toggle
        v.onZoom(onZoom(v)) *> // re render on zoom
        v.onPositionChanged(onPositionChanged(v)) *>
        v.onMouseMove(s => Callback.log(s"$s"))

    def updateVisualization(s: Svg)(v: JsAladin): Callback = {
      val size = Size(v.getParentDiv().clientHeight, v.getParentDiv().clientWidth)
      val div  = v.getParentDiv()
      renderVisualization(s, div, size, v.pixelScale)
    }

    def updateVisualization(v: JsAladin): Callback =
      $.state.flatMap(s => s.svg.map(updateVisualization(_)(v)).getOrEmpty)

    def render(props: Props) =
      <.div(
        ^.width := 100.pct,
        ^.height := 100.pct,
        AladinComp.withRef(aladinRef) {
          Aladin(
            showReticle = false,
            showFullscreenControl = true,
            target = props.aladinCoordsStr,
            // target = "ngc 1055",
            fov = 0.25,
            showGotoControl = false,
            customize = includeSvg _
          )
        }
      )

    def onZoom(v: JsAladin): Callback =
      updateSvgState(v.pixelScale).flatMap { s =>
        aladinRef.get.flatMapCB(r =>
          r.backend.recalculateView *>
            r.backend.runOnAladinCB(updateVisualization(s))
        )
      }

    /**
      * Called when the position changes, i.e. aladin pans. We want to offset the visualization to
      * keep the internal target correct
      */
    def onPositionChanged(v: JsAladin)(s: PositionChanged): Callback =
      $.props
        .zip($.state)
        .flatMap {
          case (p, s) =>
            val size = Size(v.getParentDiv().clientHeight, v.getParentDiv().clientWidth)
            val div  = v.getParentDiv()
            // Update the existing visualization in place
            val previous = Option(div.querySelector(".aladin-visualization"))
            (s.svg, previous).mapN {
              case (svg, previous) =>
                aladinRef.get
                  .flatMapCB(
                    _.backend.world2pix(Coordinates(p.coordinates.ra, p.coordinates.dec))
                  )
                  .flatMapCB { off =>
                    Callback {
                      // Offset the visualization
                      visualization
                        .updatePosition(svg,
                                        previous,
                                        size,
                                        v.pixelScale,
                                        GmosGeometry.ScaleFactor,
                                        off.getOrElse((0, 0))
                        )
                    }
                  }
                  .toCallback
            }.getOrEmpty
        }
        .void

    def recalculateView =
      aladinRef.get.flatMapCB { r =>
        r.backend.pixelScale.flatMap { ps =>
          updateSvgState(ps).flatMap { s =>
            r.backend.recalculateView *> r.backend.runOnAladinCB(updateVisualization(s))
          }
        }
      }
  }

  val component =
    ScalaComponent
      .builder[Props]
      .initialState(State.Zero)
      .renderBackend[Backend]
      .componentDidMount(_.backend.initialSvgState)
      .componentDidUpdate(_.backend.recalculateView)
      .configure(Reusability.shouldComponentUpdate)
      .build

}
