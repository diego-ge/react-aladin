resolvers in Global += Resolver.sonatypeRepo("public")

addSbtPlugin("org.scala-js" % "sbt-scalajs" % "1.2.0")

addSbtPlugin("ch.epfl.scala" % "sbt-scalajs-bundler" % "0.18.0")

addSbtPlugin("org.scalameta" % "sbt-scalafmt" % "2.3.2")

addSbtPlugin("com.geirsson" % "sbt-ci-release" % "1.5.3")

addSbtPlugin("edu.gemini" % "sbt-gsp" % "0.2.5")
