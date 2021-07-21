import org.scalajs.linker.interface.ModuleSplitStyle

lazy val reactJS                = "17.0.2"
lazy val scalaJsReact           = "2.0.0-RC2"
lazy val lucumaCoreVersion      = "0.11.0"
lazy val lucumaUIVersion        = "0.17.0"
lazy val aladinLiteVersion      = "0.2.3"
lazy val reactCommonVersion     = "0.13.0"
lazy val reactGridLayoutVersion = "0.14.0"
lazy val munitVersion           = "0.7.27"
lazy val svgdotjsVersion        = "0.1.1"

inThisBuild(
  Seq(
    homepage := Some(url("https://github.com/gemini-hlsw/react-aladin")),
    Global / onChangedBuildSource := ReloadOnSourceChanges,
    scalacOptions += "-Ymacro-annotations"
  ) ++ lucumaPublishSettings
)

Global / resolvers += Resolver.sonatypeRepo("public")

addCommandAlias(
  "restartWDS",
  "; demo/fastOptJS::stopWebpackDevServer; demo/fastOptJS::startWebpackDevServer; ~demo/fastOptJS"
)

skip in publish := true

val demo =
  project
    .in(file("demo"))
    // .enablePlugins(ScalaJSBundlerPlugin)
    .enablePlugins(ScalaJSPlugin)
    .settings(lucumaScalaJsSettings: _*)
    .settings(commonSettings: _*)
    .settings(
      skip in publish := true,
      scalaJSLinkerConfig ~= { _.withModuleKind(ModuleKind.ESModule) },
      scalaJSLinkerConfig ~= (_.withModuleSplitStyle(ModuleSplitStyle.SmallestModules)),
      version in webpack := "4.44.1",
      version in startWebpackDevServer := "3.11.0",
      webpackConfigFile in fastOptJS := Some(
        baseDirectory.value / "webpack" / "dev.webpack.config.js"
      ),
      webpackConfigFile in fullOptJS := Some(
        baseDirectory.value / "webpack" / "prod.webpack.config.js"
      ),
      // webpackMonitoredDirectories += (resourceDirectory in Compile).value,
      webpackResources := (baseDirectory.value / "webpack") * "*.js",
      includeFilter in webpackMonitoredFiles := "*",
      webpackExtraArgs := Seq("--progress"),
      // webpackExtraArgs                       := Seq("--progress", "--display", "verbose"),
      useYarn := true,
      webpackBundlingMode in fastOptJS := BundlingMode.LibraryOnly(),
      webpackBundlingMode in fullOptJS := BundlingMode.Application,
      test := {},
      scalaJSLinkerConfig in (Compile, fastOptJS) ~= { _.withSourceMap(false) },
      scalaJSLinkerConfig in (Compile, fullOptJS) ~= { _.withSourceMap(false) },
      libraryDependencies ++= Seq(
        "edu.gemini"                        %%% "lucuma-core"        % lucumaCoreVersion,
        "edu.gemini"                        %%% "lucuma-ui"          % lucumaUIVersion,
        "edu.gemini"                        %%% "lucuma-svgdotjs"    % svgdotjsVersion,
        "com.github.japgolly.scalajs-react" %%% "core"               % scalaJsReact,
        "com.github.japgolly.scalajs-react" %%% "extra-ext-monocle3" % scalaJsReact,
        "com.github.japgolly.scalajs-react" %%% "test"               % scalaJsReact % Test,
        "io.github.cquiroz.react"           %%% "common"             % reactCommonVersion,
        "io.github.cquiroz.react"           %%% "react-grid-layout"  % reactGridLayoutVersion
      ),
      // don't publish the demo
      publish := {},
      publishLocal := {},
      publishArtifact := false,
      Keys.`package` := file("")
    )

def copyAndReplace(srcFiles: Seq[File], srcRoot: File, destinationDir: File): Seq[File] = {
  def replacements(line: String): String =
    line
      .replaceAll("/js/", "@cquiroz/aladin-lite/lib/js/")

  // Visit each file and read the content replacing key strings
  srcFiles.filter(_.getPath.contains("react/aladin")).flatMap { f =>
    f.relativeTo(srcRoot)
      .map { r =>
        val target        = new File(destinationDir, r.getPath)
        val replacedLines = IO.readLines(f).map(replacements)
        IO.createDirectory(target.getParentFile)
        IO.writeLines(target, replacedLines)
        Seq(target)
      }
      .getOrElse(Seq.empty)
  }
}

lazy val facade =
  project
    .in(file("facade"))
    .enablePlugins(ScalaJSPlugin)
    .enablePlugins(ScalaJSBundlerPlugin)
    .enablePlugins(AutomateHeaderPlugin)
    .settings(lucumaScalaJsSettings: _*)
    .settings(commonSettings: _*)
    .settings(
      name := "react-aladin",
      npmDependencies in Compile ++= Seq(
        "react"                -> reactJS,
        "react-dom"            -> reactJS,
        "@cquiroz/aladin-lite" -> aladinLiteVersion
      ),
      npmDevDependencies in Test ++= Seq(
        "chokidar" -> "3.4.2"
      ),
      // Requires the DOM for tests
      requireJsDomEnv in Test := true,
      // Use yarn as it is faster than npm
      useYarn := true,
      version in webpack := "4.20.2",
      version in startWebpackDevServer := "3.1.8",
      scalaJSUseMainModuleInitializer := false,
      // Compile tests to JS using fast-optimisation
      scalaJSStage in Test := FastOptStage,
      libraryDependencies ++= Seq(
        "edu.gemini"                        %%% "lucuma-core"     % lucumaCoreVersion,
        "edu.gemini"                        %%% "lucuma-ui"       % lucumaUIVersion,
        "edu.gemini"                        %%% "lucuma-svgdotjs" % svgdotjsVersion,
        "com.github.japgolly.scalajs-react" %%% "core"            % scalaJsReact,
        "com.github.japgolly.scalajs-react" %%% "test"            % scalaJsReact % Test,
        "io.github.cquiroz.react"           %%% "common"          % reactCommonVersion,
        "org.scalameta"                     %%% "munit"           % munitVersion % Test
      ),
      testFrameworks += new TestFramework("munit.Framework"),
      webpackConfigFile in Test := Some(
        baseDirectory.value / "src" / "webpack" / "test.webpack.config.js"
      ),
      Compile / sourceGenerators += Def.task {
        val srcDir         = (demo / Compile / scalaSource).value
        val srcFiles       = srcDir ** "*.scala"
        val destinationDir = (Compile / sourceManaged).value
        copyAndReplace(srcFiles.get, srcDir, destinationDir)
      }.taskValue
    )

lazy val commonSettings = Seq(
  description := "react component for aladin",
  scalacOptions ~= (_.filterNot(
    Set(
      // By necessity facades will have unused params
      "-Wdead-code",
      "-Wunused:params",
      "-Wunused:explicits"
    )
  ))
)
