// Copyright (c) 2016-2022 Association of Universities for Research in Astronomy, Inc. (AURA)
// For license information see LICENSE or https://opensource.org/licenses/BSD-3-Clause

package react.semanticui.demo

import scala.scalajs.js
// import scala.scalajs.js.annotation.JSImport

object WebpackResources {
  // marker trait
  trait WebpackResource extends js.Object

  implicit class WebpackResourceOps(val r: WebpackResource) extends AnyVal {
    def resource: String = r.toString
  }
}
