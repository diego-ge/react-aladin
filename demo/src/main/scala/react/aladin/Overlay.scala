// Copyright (c) 2016-2022 Association of Universities for Research in Astronomy, Inc. (AURA)
// For license information see LICENSE or https://opensource.org/licenses/BSD-3-Clause

package react.aladin

import scala.scalajs.js
import scala.scalajs.js.annotation._
import scala.scalajs.js.|
import scala.annotation.nowarn

@js.native
@JSImport("@cquiroz/aladin-lite/lib/Overlay", JSImport.Namespace)
@nowarn
class AladinOverlay extends js.Object {
  def addFootprints(s: js.Array[AladinOverlay.Shapes]): Unit = js.native
  def add(s: AladinOverlay.Shapes): Unit                     = js.native
}

object AladinOverlay {
  type Shapes = AladinCircle | AladinFootprint | AladinPolyline
}
