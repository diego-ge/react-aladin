// Copyright 2013 - UDS/CNRS
// The Aladin Lite program is distributed under the terms
// of the GNU General Public License version 3.
//
// This file is part of Aladin Lite.
//
//    Aladin Lite is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, version 3 of the License.
//
//    Aladin Lite is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    The GNU General Public License is available in COPYING file
//    along with Aladin Lite.
//

/******************************************************************************
 * Aladin Lite project
 *
 * File Aladin.js (main class)
 * Facade to expose Aladin Lite methods
 *
 * Author: Thomas Boch[CDS]
 *
 *****************************************************************************/
import CooFrameEnum from "./CooFrameEnum";
import Coo from "./coo";
import AladinUtils from "./AladinUtils";
import { HpxImageSurvey } from "./HpxImageSurvey";
import CooConversion from "./CooConversion";
import MeasurementTable from "./MeasurementTable";
import Overlay from "./Overlay";
import View from "./View";
import Logger from "./Logger";
import Location from "./Location";
import Utils from "./Utils";
import ProjectionEnum from "./ProjectionEnum";
import ProgressiveCat from "./ProgressiveCat";
import Color from "./Color";
import ColorMap from "./ColorMap";
import Box from "./Box";
import Source from "./Source";
import { catalog, footprintsFromSTCS, catalogFromURL, marker } from "./A";

const Aladin = (function () {
  const urlParam = function (name, queryString) {
    if (queryString === undefined) {
      queryString = window.location.search;
    }
    return (
      decodeURIComponent(
        (new RegExp("[?|&]" + name + "=([^&;]+?)(&|#|;|$)").exec(
          queryString
        ) || ["", ""])[1].replace(/\+/g, "%20")
      ) || null
    );
  };

  // Constructor
  const Aladin = function (aladinDiv, requestedOptions) {
    // check that aladinDiv exists, stop immediately otherwise
    if (!aladinDiv) {
      console.log(
        "Could not find div " +
          aladinDiv +
          ". Aborting creation of Aladin Lite instance"
      );
      return;
    }

    const self = this;
    var aladin = this;

    // if not options was set, try to retrieve them from the query string
    if (requestedOptions === undefined) {
      requestedOptions = this.getOptionsFromQueryString();
    }
    requestedOptions = requestedOptions || {};

    // merge with default options
    const options = {};
    for (let key in Aladin.DEFAULT_OPTIONS) {
      if (requestedOptions[key] !== undefined) {
        options[key] = requestedOptions[key];
      } else {
        options[key] = Aladin.DEFAULT_OPTIONS[key];
      }
    }
    for (let key in requestedOptions) {
      if (Aladin.DEFAULT_OPTIONS[key] === undefined) {
        options[key] = requestedOptions[key];
      }
    }

    this.options = options;

    // It seems this isn't in use
    // $("<style type='text/css'> .aladin-reticleColor { color: " + this.options.reticleColor + "; font-weight:bold;} </style>").appendTo(aladinDiv);

    this.aladinDiv = aladinDiv;

    this.reduceDeformations = true;

    // parent div
    aladinDiv.classList.add("aladin-container");

    const cooFrame = CooFrameEnum.fromString(
      options.cooFrame,
      CooFrameEnum.J2000
    );
    // locationDiv is the div where we write the position
    // var locationDiv = $(
    //   '<div class="aladin-location">' +
    //     (options.showFrame
    //       ? '<select class="aladin-frameChoice"><option value="' +
    //         CooFrameEnum.J2000.label +
    //         '" ' +
    //         (cooFrame === CooFrameEnum.J2000 ? 'selected="selected"' : "") +
    //         '>J2000</option><option value="' +
    //         CooFrameEnum.J2000d.label +
    //         '" ' +
    //         (cooFrame === CooFrameEnum.J2000d ? 'selected="selected"' : "") +
    //         '>J2000d</option><option value="' +
    //         CooFrameEnum.GAL.label +
    //         '" ' +
    //         (cooFrame === CooFrameEnum.GAL ? 'selected="selected"' : "") +
    //         ">GAL</option></select>"
    //       : "") +
    //     '<span class="aladin-location-text"></span></div>'
    // ).appendTo(aladinDiv);
    let locationDiv = document.createElement("div");
    locationDiv.classList.add("aladin-location");

    const frameSelect = document.createElement("select");
    frameSelect.classList.add("aladin-frameChoice");
    const all = [CooFrameEnum.J2000, CooFrameEnum.J2000d, CooFrameEnum.GAL];
    all.forEach((f) => {
      const selectOption = document.createElement("option");
      selectOption.value = f.label;
      selectOption.innerHTML = f.label;
      selectOption.selected = cooFrame === f;
      frameSelect.appendChild(selectOption);
    });
    const locationText = document.createElement("span");
    locationText.classList.add("aladin-location-text");

    locationDiv.appendChild(frameSelect);
    locationDiv.appendChild(locationText);
    aladinDiv.appendChild(locationDiv);
    if (!options.showCoordinates) {
      locationDiv.style.display = "none";
    }

    // div where FoV value is written
    let fovDiv = null;
    if (options.showFov) {
      fovDiv = document.createElement("div");
      fovDiv.classList.add("aladin-fov");
      aladinDiv.appendChild(fovDiv);
      // $('<div class="aladin-fov"></div>').appendTo(aladinDiv);
    }

    // zoom control
    if (options.showZoomControl) {
      // $(
      //   '<div class="aladin-zoomControl"><a href="#" class="zoomPlus" title="Zoom in">+</a><a href="#" class="zoomMinus" title="Zoom out">&ndash;</a></div>'
      // ).appendTo(aladinDiv);
      const zoomDiv = document.createElement("div");
      zoomDiv.classList.add("aladin-zoomControl");
      const zoomPlus = document.createElement("a");
      zoomPlus.href = "#";
      zoomPlus.title = "Zoom in";
      zoomPlus.innerHTML = "+";
      zoomPlus.classList.add("zoomPlus");
      zoomDiv.appendChild(zoomPlus);
      const zoomMinus = document.createElement("a");
      zoomMinus.href = "#";
      zoomMinus.title = "Zoom out";
      zoomMinus.innerHTML = "&ndash;";
      zoomMinus.classList.add("zoomMinus");
      zoomDiv.appendChild(zoomMinus);
      aladinDiv.appendChild(zoomDiv);

      zoomPlus.addEventListener("click", (e) => {
        e.preventDefault()
        aladin.increaseZoom()
      })
      zoomPlus.addEventListener("mousedown", (e) => e.preventDefault())

      zoomMinus.addEventListener("click", (e) => {
        e.preventDefault()
        aladin.decreaseZoom()
      })
      zoomMinus.addEventListener("mousedown", (e) => e.preventDefault())
    }

    // maximize control
    if (options.showFullscreenControl) {
      const fullScreenDiv = document.createElement("div");
      fullScreenDiv.title = "Full screen";
      fullScreenDiv.classList.add("aladin-fullscreenControl");
      fullScreenDiv.classList.add("aladin-maximize");
      aladinDiv.appendChild(fullScreenDiv);
      // $(
      //   '<div class="aladin-fullscreenControl aladin-maximize" title="Full screen"></div>'
      // ).appendTo(aladinDiv);
    }
    this.fullScreenBtn = aladinDiv.querySelectorAll(
      ".aladin-fullscreenControl"
    )[0];
    if (this.fullScreenBtn) {
      this.fullScreenBtn.addEventListener("click", () => {
        self.toggleFullscreen(self.options.realFullscreen);
      });
    }
    // react to fullscreenchange event to restore initial width/height (if user pressed ESC to go back from full screen)
    document.addEventListener("fullscreenchange webkitfullscreenchange mozfullscreenchange MSFullscreenChange", () => {
      var fullscreenElt =
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement;
      if (fullscreenElt === null || fullscreenElt === undefined) {
        self.fullScreenBtn.classList.remove("aladin-restore");
        self.fullScreenBtn.classList.add("aladin-maximize");
        self.fullScreenBtn.title = "Full screen";
        self.aladinDiv.classList.remove("aladin-fullscreen");

        var fullScreenToggledFn = self.callbacksByEventName["fullScreenToggled"];
        var isInFullscreen = self.fullScreenBtn.classList.contains(
          "aladin-restore"
        );
        typeof fullScreenToggledFn === "function" &&
          fullScreenToggledFn(isInFullscreen);
      }
    })

    // Aladin logo
    const logo = document.createElement("div")
    logo.classList.add("aladin-logo-container")
    const logoRef = document.createElement("a")
    logoRef.href = "http://aladin.unistra.fr"
    logoRef.title = "Powored by Alading Lite"
    logoRef.target = "_blank"
    logoRef.target = "_blank"
    const logoLogo = document.createElement("div")
    logoLogo.classList.add("aladin-logo")
    logoRef.appendChild(logoLogo)
    logo.appendChild(logoRef)
    aladinDiv.appendChild(logo)

    // $(
    //   "<div class='aladin-logo-container'><a href='http://aladin.unistra.fr/' title='Powered by Aladin Lite' target='_blank'><div class='aladin-logo'></div></a></div>"
    // ).appendTo(aladinDiv);

    // we store the boxes
    this.boxes = [];

    // measurement table
    this.measurementTable = new MeasurementTable(aladinDiv);

    const aladinLocation = new Location(
      locationDiv.querySelectorAll(".aladin-location-text")[0]
    );

    // set different options
    this.view = new View(this, aladinLocation, fovDiv, cooFrame, options.fov);
    this.view.setShowGrid(options.showCooGrid);
    this.setImageSurvey(options.survey);
    this.view.showCatalog(options.showCatalog);

    // retrieve available surveys
    // TODO: replace call with MocServer
    // $.ajax({
    //   url: "//aladin.unistra.fr/java/nph-aladin.pl",
    //   data: { frame: "aladinLiteDic" },
    //   method: "GET",
    //   dataType: "jsonp", // could this be repaced by json ??
    //   success: function (data) {
    //     var map = {};
    //     for (let k = 0; k < data.length; k++) {
    //       map[data[k].id] = true;
    //     }
    //     // retrieve existing surveys
    //     for (let k = 0; k < HpxImageSurvey.SURVEYS.length; k++) {
    //       if (!map[HpxImageSurvey.SURVEYS[k].id]) {
    //         data.push(HpxImageSurvey.SURVEYS[k]);
    //       }
    //     }
    //     console.log(data)
    //     HpxImageSurvey.SURVEYS = data;
    //     self.view.setUnknownSurveyIfNeeded();
    //   },
    //   error: function () {},
    // });

    fetch("https://lucuma-cors-proxy.herokuapp.com/http://aladin.unistra.fr/java/nph-aladin.pl?frame=aladinLiteDic")
    .then(response => response.json())
    .then(data => {
      var map = {};
      for (let k = 0; k < data.length; k++) {
        map[data[k].id] = true;
      }
      // retrieve existing surveys
      for (let k = 0; k < HpxImageSurvey.SURVEYS.length; k++) {
        if (!map[HpxImageSurvey.SURVEYS[k].id]) {
          data.push(HpxImageSurvey.SURVEYS[k]);
        }
      }
      HpxImageSurvey.SURVEYS = data;
      self.view.setUnknownSurveyIfNeeded();
    });

    // layers control panel
    // TODO : valeur des checkbox en fonction des options
    // TODO : classe LayerBox
    if (options.showLayersControl) {
      // let d = $(
      //   '<div class="aladin-layersControl-container" title="Manage layers"><div class="aladin-layersControl"></div></div>'
      // );
      // d.appendTo(aladinDiv);

      let innerDiv = document.createElement("div")
      innerDiv.classList.add("aladin-layersControl")
      let layerDiv = document.createElement("div")
      layerDiv.title = "Manage layers"
      layerDiv.classList.add("aladin-layersControl-container")
      layerDiv.appendChild(innerDiv)
      aladinDiv.appendChild(layerDiv)

      // var layerBox = $(
      //   '<div class="aladin-box aladin-layerBox aladin-cb-list"></div>'
      // );
      // layerBox.appendTo(aladinDiv);

      let layerBox = document.createElement("div")
      layerBox.classList.add("aladin-box","aladin-layerBox","aladin-cb-list")
      aladinDiv.appendChild(layerBox)

      this.boxes.push(layerBox)

      // we return false so that the default event is not submitted, and to prevent event bubbling
      layerDiv.addEventListener('click', () => {
        self.hideBoxes()
        self.showLayerBox(layerBox)
      })
      // d1.click(function () {
      //   self.hideBoxes();
      //   self.showLayerBox();
      //   return false;
      // });
    }

    // goto control panel
    if (options.showGotoControl) {
      // let d = $(
      //   '<div class="aladin-gotoControl-container" title="Go to position"><div class="aladin-gotoControl"></div></div>'
      // );
      // d.appendTo(aladinDiv);

      let innerDiv = document.createElement("div")
      innerDiv.classList.add("aladin-gotoControl")
      let controlDiv = document.createElement("div")
      controlDiv.title = "Go to position"
      controlDiv.classList.add("aladin-gotoControl-container")
      controlDiv.appendChild(innerDiv)
      aladinDiv.appendChild(controlDiv)

      // var gotoBox = $(
      //   '<div class="aladin-box aladin-gotoBox">' +
      //     '<a class="aladin-closeBtn">&times;</a>' +
      //     '<div style="clear: both;"></div>' +
      //     '<form class="aladin-target-form">Go to: <input type="text" placeholder="Object name/position" /></form></div>'
      // );
      // gotoBox.appendTo(aladinDiv);

      let inputInForm = document.createElement("input")
      inputInForm.type = "text"
      inputInForm.placeholder = "Object name/position"
      let formInBox = document.createElement("form")
      formInBox.classList.add("aladin-target-form")
      formInBox.innerText = "Go to: "
      formInBox.appendChild(inputInForm)
      let divInBox = document.createElement("div")
      divInBox.style.clear = "both";
      let aInBox = document.createElement("a")
      aInBox.classList.add("aladin-closeBtn")
      aInBox.innerHTML = "&times;"
      let gotoBox = document.createElement("div")
      gotoBox.classList.add("aladin-box", "aladin-gotoBox")
      gotoBox.appendChild(aInBox)
      gotoBox.appendChild(divInBox)
      gotoBox.appendChild(formInBox)
      aladinDiv.appendChild(gotoBox)

      this.boxes.push(gotoBox);

      formInBox.addEventListener("submit", (e) => {
        e.preventDefault()
        aladin.gotoObject(inputInForm.value, {
          success: (raDec) => {
            console.log(`Callback response on success ${raDec}`)
            // targetFormInput.classList.add("aladin-unknownObject")
          },
          error: (raDec) => {
            console.log(`Callback response on error ${raDec}`)
            // targetFormInput.classList.add("aladin-unknownObject")
          }
        })
      })

      inputInForm.addEventListener("paste", () => inputInForm.classList.remove("aladin-unknownObject"))
      inputInForm.addEventListener("keydown", () => inputInForm.classList.remove("aladin-unknownObject"))
      aInBox.addEventListener("click", () => self.hideBoxes())
      controlDiv.addEventListener("click", () => {
        self.hideBoxes()
        inputInForm.value = ""
        inputInForm.classList.remove("aladin-unknownObject");
        gotoBox.style.display = "block";
        inputInForm.focus()
      })

      // // TODO : classe GotoBox
    }

    // simbad pointer tool
    if (options.showSimbadPointerControl) {
      // let d = $(
      //   '<div class="aladin-simbadPointerControl-container" title="SIMBAD pointer"><div class="aladin-simbadPointerControl"></div></div>'
      // );
      // d.appendTo(aladinDiv);
      let innerDiv = document.createElement("div")
      innerDiv.classList.add("aladin-simbadPointerControl")
      let simbadPinterDiv = document.createElement("div")
      simbadPinterDiv.title = "SIMBAD pointer"
      simbadPinterDiv.classList.add("aladin-simbadPointerControl-container")
      simbadPinterDiv.appendChild(innerDiv)
      aladinDiv.appendChild(simbadPinterDiv)

      // d.click(function () {
      //   self.view.setMode(View.TOOL_SIMBAD_POINTER);
      // });
      simbadPinterDiv.addEventListener("click", () => self.view.setMode(View.TOOL_SIMBAD_POINTER))
    }

    // share control panel
    if (options.showShareControl) {
      // let d = $(
      //   '<div class="aladin-shareControl-container" title="Get link for current view"><div class="aladin-shareControl"></div></div>'
      // );
      // d.appendTo(aladinDiv);
      let innerDiv = document.createElement("div")
      innerDiv.classList.add("aladin-shareControl")
      let shareControlDiv = document.createElement("div")
      shareControlDiv.title = "Get link for current view"
      shareControlDiv.classList.add("aladin-shareControl-container")
      shareControlDiv.appendChild(innerDiv)
      aladinDiv.appendChild(shareControlDiv)

      // var shareBox = $(
      //   '<div class="aladin-box aladin-shareBox">' +
      //     '<a class="aladin-closeBtn">&times;</a>' +
      //     '<div style="clear: both;"></div>' +
      //     'Link to previewer: <span class="info"></span>' +
      //     '<input type="text" class="aladin-shareInput" />' +
      //     "</div>"
      // );
      // shareBox.appendTo(aladinDiv);
      let inputShareBox = document.createElement("input")
      inputShareBox.type = "text"
      inputShareBox.classList.add("aladin-shareInput")
      let spanShareBox = document.createElement("span")
      spanShareBox.classList.add("info")
      let divShareBox = document.createElement("div")
      divShareBox.style.clear = "both"
      let aShareBox = document.createElement("a")
      aShareBox.innerHTML = "&times;"
      aShareBox.classList.add("aladin-closeBtn")
      let shareBox = document.createElement("div")
      shareBox.classList.add("aladin-box", "aladin-shareBox")
      shareBox.appendChild(aShareBox)
      shareBox.appendChild(divShareBox)
      shareBox.innerHTML += "Link to previewer: "
      shareBox.appendChild(spanShareBox)
      shareBox.appendChild(inputShareBox)
      aladinDiv.appendChild(shareBox)

      this.boxes.push(shareBox);

      // TODO : classe GotoBox, GenericBox
      // d.click(function () {
      //   self.hideBoxes();
      //   shareBox.show();
      //   var url = self.getShareURL();
      //   shareBox.find(".aladin-shareInput").val(url).select();
      //   document.execCommand("copy");

      //   return false;
      // });

      shareControlDiv.addEventListener("click", () => {
        self.hideBoxes()
        shareBox.style.display = "block"
        var url = self.getShareURL()
        inputShareBox.value = url
        inputShareBox.select()
        inputShareBox.setSelectionRange(0, 99999)
        navigator.clipboard.writeText(inputShareBox.value);
      })

      // shareBox.find(".aladin-closeBtn").click(function () {
      //   self.hideBoxes();
      //   return false;
      // });
      shareBox.getElementsByClassName("aladin-closeBtn")[0].addEventListener("click", () => self.hideBoxes())
    }

    this.gotoObject(options.target);

    if (options.log) {
      var params = Object.assign({}, requestedOptions);
      params.version = Aladin.VERSION;
      Logger.log("startup", params);
    }

    this.showReticle(options.showReticle);

    if (options.catalogUrls) {
      for (var k = 0, len = options.catalogUrls.length; k < len; k++) {
        this.createCatalogFromVOTable(options.catalogUrls[k]);
      }
    }

    // this.setImageSurvey(options.survey);
    // this.view.showCatalog(options.showCatalog);
    let frameChoice = aladinDiv.getElementsByClassName("aladin-frameChoice")[0]
    if (frameChoice) {
      frameChoice.addEventListener("change", (e) => aladin.setFrame(e.target.value))
    }

    // go to full screen ?
    if (options.fullScreen) {
      window.setTimeout(function () {
        self.toggleFullscreen(self.options.realFullscreen);
      }, 1000);
    }

    this.callbacksByEventName = {}; // we store the callback functions (on 'zoomChanged', 'positionChanged', ...) here
  };

  /**** CONSTANTS ****/
  Aladin.VERSION = "{ALADIN-LITE-VERSION-NUMBER}"; // will be filled by the build.sh script

  Aladin.JSONP_PROXY = "https://alasky.unistra.fr/cgi/JSONProxy";
  //Aladin.JSONP_PROXY = "https://alaskybis.unistra.fr/cgi/JSONProxy";

  Aladin.DEFAULT_OPTIONS = {
    target: "0 +0",
    cooFrame: "J2000",
    survey: "P/DSS2/color",
    fov: 60,
    showReticle: true,
    showZoomControl: true,
    showFullscreenControl: true,
    showLayersControl: true,
    showGotoControl: true,
    showSimbadPointerControl: false,
    showShareControl: false,
    showCatalog: true, // TODO: still used ??
    showFrame: true,
    showCooGrid: false,
    showFov: false,
    showCoordinates: false,
    fullScreen: false,
    reticleColor: "rgb(178, 50, 178)",
    reticleSize: 22,
    log: true,
    allowFullZoomout: false,
    realFullscreen: false,
    showAllskyRing: false,
    allskyRingColor: "#c8c8ff",
    allskyRingWidth: 8,
    pixelateCanvas: true,
  };

  Aladin.prototype.recalculateView = function () {
    this.view.setZoomLevel(this.view.zoomLevel);
    this.view.fixLayoutDimensions();
  };

  // realFullscreen: AL div expands not only to the size of its parent, but takes the whole available screen estate
  Aladin.prototype.toggleFullscreen = function (realFullscreen) {
    realFullscreen = Boolean(realFullscreen);

    this.fullScreenBtn.classList.toggle("aladin-maximize");
    this.fullScreenBtn.classList.toggle("aladin-restore");
    var isInFullscreen = this.fullScreenBtn.classList.contains(
      "aladin-restore"
    );
    this.fullScreenBtn.setAttribute(
      "title",
      isInFullscreen ? "Restore original size" : "Full screen"
    );
    this.aladinDiv.classList.toggle("aladin-fullscreen");

    if (realFullscreen) {
      // go to "real" full screen mode
      if (isInFullscreen) {
        var d = this.aladinDiv;

        if (d.requestFullscreen) {
          d.requestFullscreen();
        } else if (d.webkitRequestFullscreen) {
          d.webkitRequestFullscreen();
        } else if (d.mozRequestFullScreen) {
          // notice the difference in capitalization for Mozilla functions ...
          d.mozRequestFullScreen();
        } else if (d.msRequestFullscreen) {
          d.msRequestFullscreen();
        }
      }
      // exit from "real" full screen mode
      else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          document.mozCancelFullScreen();
        }
      }
    }

    this.view.fixLayoutDimensions();

    // force call to zoomChanged callback
    var fovChangedFn = this.callbacksByEventName["zoomChanged"];
    typeof fovChangedFn === "function" && fovChangedFn(this.view.fov);

    var fullScreenToggledFn = this.callbacksByEventName["fullScreenToggled"];
    typeof fullScreenToggledFn === "function" &&
      fullScreenToggledFn(isInFullscreen);
  };

  Aladin.prototype.updateSurveysDropdownList = function (surveys) {
    surveys = surveys.sort(function (a, b) {
      if (!a.order) {
        return a.id > b.id;
      }
      return a.order && a.order > b.order ? 1 : -1;
    });
    let select = this.aladinDiv.getElementsByClassName("aladin-surveySelection")[0]
    if (select) {
      select.innerHTML = ""
      for (let i = 0; i < surveys.length; i++) {
        let opt = document.createElement("option")
        opt.selected = (this.view.imageSurvey.id === surveys[i].id)
        opt.value = surveys[i].id
        opt.innerText = surveys[i].name
        select.appendChild(opt)
      }
    }
    // var select = $(this.aladinDiv).find(".aladin-surveySelection");
    // select.empty();
    // for (var i = 0; i < surveys.length; i++) {
    //   var isCurSurvey = this.view.imageSurvey.id === surveys[i].id;
    //   select.append(
    //     $("<option />")
    //       .attr("selected", isCurSurvey)
    //       .val(surveys[i].id)
    //       .text(surveys[i].name)
    //   );
    // }
  };

  Aladin.prototype.getOptionsFromQueryString = function () {
    var options = {};
    var requestedTarget = urlParam("target");
    if (requestedTarget) {
      options.target = requestedTarget;
    }
    var requestedFrame = urlParam("frame");
    if (requestedFrame && CooFrameEnum[requestedFrame]) {
      options.frame = requestedFrame;
    }
    var requestedSurveyId = urlParam("survey");
    if (
      requestedSurveyId &&
      HpxImageSurvey.getSurveyInfoFromId(requestedSurveyId)
    ) {
      options.survey = requestedSurveyId;
    }
    var requestedZoom = urlParam("zoom");
    if (requestedZoom && requestedZoom > 0 && requestedZoom < 180) {
      options.zoom = requestedZoom;
    }

    var requestedShowreticle = urlParam("showReticle");
    if (requestedShowreticle) {
      options.showReticle = requestedShowreticle.toLowerCase() === "true";
    }

    var requestedCooFrame = urlParam("cooFrame");
    if (requestedCooFrame) {
      options.cooFrame = requestedCooFrame;
    }

    var requestedFullscreen = urlParam("fullScreen");
    if (requestedFullscreen !== undefined) {
      options.fullScreen = requestedFullscreen;
    }

    return options;
  };

  // TODO: rename to setFoV
  //@oldAPI
  Aladin.prototype.setZoom = function (fovDegrees) {
    this.view.setZoom(fovDegrees);
  };

  // @API
  Aladin.prototype.setFoV = Aladin.prototype.setFov = function (fovDegrees) {
    this.view.setZoom(fovDegrees);
  };

  // @API
  // (experimental) try to adjust the FoV to the given object name. Does nothing if object is not known from Simbad
  Aladin.prototype.adjustFovForObject = function (objectName) {
    var self = this;
    this.getFovForObject(objectName, function (fovDegrees) {
      self.setFoV(fovDegrees);
    });
  };

  Aladin.prototype.getFovForObject = function (objectName, callback) {
    const query =
      `SELECT galdim_majaxis, V FROM basic JOIN ident ON oid=ident.oidref JOIN allfluxes ON oid=allfluxes.oidref WHERE id='${objectName}'`;
    const url =
      `//simbad.u-strasbg.fr/simbad/sim-tap/sync?query=${encodeURIComponent(query)}&request=doQuery&lang=adql&format=json&phase=run`;

    fetch(url)
      .then(response => response.json())
      .then(result => {
        const defaultFov = 4 / 60; // 4 arcmin
        let fov = defaultFov;

        if ("data" in result && result.data.length > 0) {
          const galdimMajAxis = Utils.isNumber(result.data[0][0])
            ? result.data[0][0] / 60.0
            : null; // result gives galdim in arcmin
          const magV = Utils.isNumber(result.data[0][1]) ? result.data[0][1] : null;

          if (galdimMajAxis !== null) {
            fov = 2 * galdimMajAxis;
          } else if (magV !== null) {
            if (magV < 10) {
              fov = (2 * Math.pow(2.0, 6 - magV / 2.0)) / 60;
            }
          }
        }

        callback(fov);
      });
  };

  Aladin.prototype.setFrame = function (frameName) {
    if (!frameName) {
      return;
    }
    var newFrame = CooFrameEnum.fromString(frameName, CooFrameEnum.J2000);
    if (newFrame === this.view.cooFrame) {
      return;
    }

    this.view.changeFrame(newFrame);
    // màj select box
    let frameChoice = document.getElementsByClassName("aladin-frameChoice")[0]
    if (frameChoice)
      frameChoice.value = newFrame.label
    // $(this.aladinDiv).find(".aladin-frameChoice").val(newFrame.label);
  };

  Aladin.prototype.setProjection = function (projectionName) {
    if (!projectionName) {
      return;
    }
    projectionName = projectionName.toLowerCase();
    switch (projectionName) {
      case "aitoff":
        this.view.changeProjection(ProjectionEnum.AITOFF);
        break;
      case "sinus":
      default:
        this.view.changeProjection(ProjectionEnum.SIN);
    }
  };

  /** point view to a given object (resolved by Sesame) or position
   * @api
   *
   * @param: target; object name or position
   * @callbackOptions: (optional) the object with key 'success' and/or 'error' containing the success and error callback functions.
   *
   */
  Aladin.prototype.gotoObject = function (targetName, callbackOptions) {
    // var errorCallback = undefined;
    var successCallback = undefined;
    if (typeof callbackOptions === "object") {
      if (Object.prototype.hasOwnProperty.call(callbackOptions, "success")) {
        successCallback = callbackOptions.success;
      }
      if (Object.prototype.hasOwnProperty.call(callbackOptions, "error")) {
        // errorCallback = callbackOptions.error;
      }
    }
    // this is for compatibility reason with the previous method signature which was function(targetName, errorCallback)
    else if (typeof callbackOptions === "function") {
      // errorCallback = callbackOptions;
    }

    var isObjectName = /[a-zA-Z]/.test(targetName);

    // try to parse as a position
    if (!isObjectName) {
      var coo = new Coo();

      coo.parse(targetName);
      var lonlat = [coo.lon, coo.lat];
      if (this.view.cooFrame === CooFrameEnum.GAL) {
        lonlat = CooConversion.GalacticToJ2000(lonlat);
      }
      this.view.pointTo(lonlat[0], lonlat[1]);

      typeof successCallback === "function" && successCallback(this.getRaDec());
    }
    // ask resolution by Sesame
    else {
      // TODO implement sesame resolution
      // var self = this;
      // Sesame.resolve(
      //   targetName,
      //   function (data) {
      //     // success callback
      //     var ra = data.Target.Resolver.jradeg;
      //     var dec = data.Target.Resolver.jdedeg;
      //     self.view.pointTo(ra, dec);
      //
      //     typeof successCallback === "function" &&
      //       successCallback(self.getRaDec());
      //   },
      //   function (data) {
      //     // errror callback
      //     if (console) {
      //       console.log("Could not resolve object name " + targetName);
      //       console.log(data);
      //     }
      //     typeof errorCallback === "function" && errorCallback();
      //   }
      // );
    }
  };

  /**
   * go to a given position, expressed in the current coordinate frame
   *
   * @API
   */
  Aladin.prototype.gotoPosition = function (lon, lat) {
    var radec;
    // first, convert to J2000 if needed
    if (this.view.cooFrame === CooFrameEnum.GAL) {
      radec = CooConversion.GalacticToJ2000([lon, lat]);
    } else {
      radec = [lon, lat];
    }
    this.view.pointTo(radec[0], radec[1]);
  };

  var doAnimation = function (aladin) {
    var params = aladin.animationParams;
    if (params == null || !params["running"]) {
      return;
    }
    var now = new Date().getTime();
    // this is the animation end: set the view to the end position, and call complete callback
    if (now > params["end"]) {
      aladin.gotoRaDec(params["raEnd"], params["decEnd"]);

      if (params["complete"]) {
        params["complete"]();
      }

      return;
    }

    // compute current position
    var fraction = (now - params["start"]) / (params["end"] - params["start"]);
    var curPos = intermediatePoint(
      params["raStart"],
      params["decStart"],
      params["raEnd"],
      params["decEnd"],
      fraction
    );
    var curRa = curPos[0];
    var curDec = curPos[1];
    //var curRa =  params['raStart'] + (params['raEnd'] - params['raStart']) * (now-params['start']) / (params['end'] - params['start']);
    //var curDec = params['decStart'] + (params['decEnd'] - params['decStart']) * (now-params['start']) / (params['end'] - params['start']);

    aladin.gotoRaDec(curRa, curDec);

    setTimeout(function () {
      doAnimation(aladin);
    }, 50);
  };

  /*
   * Stop all animations that have been initiated  by animateToRaDec or by zoomToFoV
   * @API
   *
   */
  Aladin.prototype.stopAnimation = function () {
    if (this.zoomAnimationParams) {
      this.zoomAnimationParams["running"] = false;
    }
    if (this.animationParams) {
      this.animationParams["running"] = false;
    }
  };

  /*
   * animate smoothly from the current position to the given ra, dec
   *
   * the total duration (in seconds) of the animation can be given (otherwise set to 5 seconds by default)
   *
   * complete: a function to call once the animation has completed
   *
   * @API
   *
   */
  Aladin.prototype.animateToRaDec = function (ra, dec, duration, complete) {
    duration = duration || 5;

    this.animationParams = null;

    var animationParams = {};
    animationParams["start"] = new Date().getTime();
    animationParams["end"] = new Date().getTime() + 1000 * duration;
    var raDec = this.getRaDec();
    animationParams["raStart"] = raDec[0];
    animationParams["decStart"] = raDec[1];
    animationParams["raEnd"] = ra;
    animationParams["decEnd"] = dec;
    animationParams["complete"] = complete;

    this.animationParams = animationParams;

    doAnimation(this);
  };

  var doZoomAnimation = function (aladin) {
    var params = aladin.zoomAnimationParams;
    if (params == null || !params["running"]) {
      return;
    }
    var now = new Date().getTime();
    // this is the zoom animation end: set the view to the end fov, and call complete callback
    if (now > params["end"]) {
      aladin.setFoV(params["fovEnd"]);

      if (params["complete"]) {
        params["complete"]();
      }

      return;
    }

    // compute current position
    var fraction = (now - params["start"]) / (params["end"] - params["start"]);
    var curFov =
      params["fovStart"] +
      (params["fovEnd"] - params["fovStart"]) * Math.sqrt(fraction);

    aladin.setFoV(curFov);

    setTimeout(function () {
      doZoomAnimation(aladin);
    }, 50);
  };
  /*
   * zoom smoothly from the current FoV to the given new fov to the given ra, dec
   *
   * the total duration (in seconds) of the animation can be given (otherwise set to 5 seconds by default)
   *
   * complete: a function to call once the animation has completed
   *
   * @API
   *
   */
  Aladin.prototype.zoomToFoV = function (fov, duration, complete) {
    duration = duration || 5;

    this.zoomAnimationParams = null;

    var zoomAnimationParams = {};
    zoomAnimationParams["start"] = new Date().getTime();
    zoomAnimationParams["end"] = new Date().getTime() + 1000 * duration;
    var fovArray = this.getFov();
    zoomAnimationParams["fovStart"] = Math.max(fovArray[0], fovArray[1]);
    zoomAnimationParams["fovEnd"] = fov;
    zoomAnimationParams["complete"] = complete;
    zoomAnimationParams["running"] = true;

    this.zoomAnimationParams = zoomAnimationParams;
    doZoomAnimation(this);
  };

  /**
   *  Compute intermediate point between points (lng1, lat1) and (lng2, lat2)
   *  at distance fraction times the total distance (fraction between 0 and 1)
   *
   *  Return intermediate points in degrees
   *
   */
  function intermediatePoint(lng1a, lat1a, lng2a, lat2a, fraction) {
    function degToRad(d) {
      return (d * Math.PI) / 180;
    }
    function radToDeg(r) {
      return (r * 180) / Math.PI;
    }
    let lat1 = degToRad(lat1a);
    let lng1 = degToRad(lng1a);
    let lat2 = degToRad(lat2a);
    let lng2 = degToRad(lng2a);
    var d =
      2 *
      Math.asin(
        Math.sqrt(
          Math.pow(Math.sin((lat1 - lat2) / 2), 2) +
            Math.cos(lat1) *
              Math.cos(lat2) *
              Math.pow(Math.sin((lng1 - lng2) / 2), 2)
        )
      );
    var A = Math.sin((1 - fraction) * d) / Math.sin(d);
    var B = Math.sin(fraction * d) / Math.sin(d);
    var x =
      A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    var y =
      A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    var z = A * Math.sin(lat1) + B * Math.sin(lat2);
    var lon = Math.atan2(y, x);
    var lat = Math.atan2(z, Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2)));

    return [radToDeg(lon), radToDeg(lat)];
  }

  /**
   * get current [ra, dec] position of the center of the view
   *
   * @API
   */
  Aladin.prototype.getRaDec = function () {
    if (this.view.cooFrame.system === CooFrameEnum.SYSTEMS.J2000) {
      return [this.view.viewCenter.lon, this.view.viewCenter.lat];
    } else {
      var radec = CooConversion.GalacticToJ2000([
        this.view.viewCenter.lon,
        this.view.viewCenter.lat,
      ]);
      return radec;
    }
  };

  /**
   * point to a given position, expressed as a ra,dec coordinate
   *
   * @API
   */
  Aladin.prototype.gotoRaDec = function (ra, dec) {
    this.view.pointTo(ra, dec);
  };

  Aladin.prototype.showHealpixGrid = function (show) {
    this.view.showHealpixGrid(show);
  };

  Aladin.prototype.showSurvey = function (show) {
    this.view.showSurvey(show);
  };
  Aladin.prototype.showCatalog = function (show) {
    this.view.showCatalog(show);
  };
  Aladin.prototype.showReticle = function (show) {
    this.view.showReticle(show);
    let reticleCheckbox = document.getElementById("displayReticle")
    if (reticleCheckbox)
      reticleCheckbox.checked = show
    // $("#displayReticle").attr("checked", show);
  };
  Aladin.prototype.removeLayers = function () {
    this.view.removeLayers();
  };

  // these 3 methods should be merged into a unique "add" method
  Aladin.prototype.addCatalog = function (catalog) {
    this.view.addCatalog(catalog);
  };
  Aladin.prototype.addOverlay = function (overlay) {
    this.view.addOverlay(overlay);
  };
  Aladin.prototype.addMOC = function (moc) {
    this.view.addMOC(moc);
  };

  // @oldAPI
  Aladin.prototype.createImageSurvey = function (
    id,
    name,
    rootUrl,
    cooFrame,
    maxOrder,
    options
  ) {
    return new HpxImageSurvey(id, name, rootUrl, cooFrame, maxOrder, options);
  };

  // @api
  Aladin.prototype.getBaseImageLayer = function () {
    return this.view.imageSurvey;
  };
  // @param imageSurvey : HpxImageSurvey object or image survey identifier
  // @api
  // @old
  Aladin.prototype.setImageSurvey = function (imageSurvey, callback) {
    this.view.setImageSurvey(imageSurvey, callback);
    this.updateSurveysDropdownList(HpxImageSurvey.getAvailableSurveys());
    if (this.options.log) {
      var id = imageSurvey;
      if (typeof imageSurvey !== "string") {
        id = imageSurvey.rootUrl;
      }

      Logger.log("changeImageSurvey", id);
    }
  };
  // @api
  Aladin.prototype.setBaseImageLayer = Aladin.prototype.setImageSurvey;

  // @api
  Aladin.prototype.getOverlayImageLayer = function () {
    return this.view.overlayImageSurvey;
  };
  // @api
  Aladin.prototype.setOverlayImageLayer = function (imageSurvey, callback) {
    this.view.setOverlayImageSurvey(imageSurvey, callback);
  };

  Aladin.prototype.increaseZoom = function (step) {
    if (!step) {
      step = 5;
    }
    this.view.setZoomLevel(this.view.zoomLevel + step);
  };

  Aladin.prototype.decreaseZoom = function (step) {
    if (!step) {
      step = 5;
    }
    this.view.setZoomLevel(this.view.zoomLevel - step);
  };

  // @oldAPI
  Aladin.prototype.createCatalog = function (options) {
    return catalog(options);
  };

  Aladin.prototype.createProgressiveCatalog = function (
    url,
    frame,
    maxOrder,
    options
  ) {
    return new ProgressiveCat(url, frame, maxOrder, options);
  };

  // @oldAPI
  Aladin.prototype.createSource = function (ra, dec, data) {
    return new Source(ra, dec, data);
  };
  // @oldAPI
  Aladin.prototype.createMarker = function (ra, dec, options, data) {
    options = options || {};
    options["marker"] = true;
    return new Source(ra, dec, data, options);
  };

  Aladin.prototype.createOverlay = function (options) {
    return new Overlay(options);
  };

  // @oldAPI
  Aladin.prototype.createFootprintsFromSTCS = function (stcs) {
    return footprintsFromSTCS(stcs);
  };

  // @oldAPI
  Aladin.prototype.createCatalogFromVOTable = function (url, options) {
    return catalogFromURL(url, options);
  };

  Aladin.AVAILABLE_CALLBACKS = [
    "select",
    "objectClicked",
    "objectHovered",
    "footprintClicked",
    "footprintHovered",
    "positionChanged",
    "zoomChanged",
    "click",
    "mouseMove",
    "fullScreenToggled",
  ];
  // API
  //
  // setting callbacks
  Aladin.prototype.on = function (what, myFunction) {
    if (Aladin.AVAILABLE_CALLBACKS.indexOf(what) < 0) {
      return;
    }

    this.callbacksByEventName[what] = myFunction;
  };

  Aladin.prototype.select = function () {
    this.fire("selectstart");
  };

  Aladin.prototype.fire = function (what, params) {
    if (what === "selectstart") {
      this.view.setMode(View.SELECT);
    } else if (what === "selectend") {
      this.view.setMode(View.PAN);
      var callbackFn = this.callbacksByEventName["select"];
      typeof callbackFn === "function" && callbackFn(params);
    }
  };

  Aladin.prototype.hideBoxes = function () {
    if (this.boxes) {
      for (var k = 0; k < this.boxes.length; k++) {
        // this.boxes[k].hide();
        this.boxes[k].style.display = "none";
      }
    }
  };

  // TODO : LayerBox (or Stack?) must be extracted as a separate object
  Aladin.prototype.showLayerBox = function (layerBox) {
    let self = this
    layerBox.innerHTML = ""
    let layerBoxCloseBtn = document.createElement("a")
    layerBoxCloseBtn.classList.add("aladin-closeBtn")
    layerBoxCloseBtn.innerHTML = "&times;"
    let layerBoxClearDiv = document.createElement("div")
    layerBoxClearDiv.style.clear = "both"
    let layerBoxLabelDiv = document.createElement("div")
    layerBoxLabelDiv.classList.add("aladin-label")
    layerBoxLabelDiv.innerText = "Base image layer"
    let layerBoxSelect = document.createElement("select")
    layerBoxSelect.classList.add("aladin-surveySelection")
    let layerBoxCmapDiv = document.createElement("div")
    layerBoxCmapDiv.classList.add("aladin-cmap")
    layerBoxCmapDiv.innerText = "Color map:"
    let layerBoxCmapInnerDiv = document.createElement("div")
    let layerBoxCmapSelect = document.createElement("select")
    layerBoxCmapSelect.classList.add("aladin-cmSelection")
    let layerBoxCmapBtn = document.createElement("button")
    layerBoxCmapBtn.classList.add("aladin-btn", "aladin-btn-small", "aladin-reverseCm")
    layerBoxCmapBtn.type = "button"
    layerBoxCmapBtn.innerText = "Reverse"
    layerBoxCmapInnerDiv.appendChild(layerBoxCmapSelect)
    layerBoxCmapInnerDiv.appendChild(layerBoxCmapBtn)
    layerBoxCmapDiv.appendChild(layerBoxCmapInnerDiv)
    let layerBoxSeparatorDiv = document.createElement("div")
    layerBoxSeparatorDiv.classList.add("aladin-box-separator")
    let layerBoxOverlayDiv = document.createElement("div")
    layerBoxOverlayDiv.classList.add("aladin-label")
    layerBoxOverlayDiv.innerText = "Overlay layers"
    layerBox.appendChild(layerBoxCloseBtn)
    layerBox.appendChild(layerBoxClearDiv)
    layerBox.appendChild(layerBoxSelect)
    layerBox.appendChild(layerBoxCmapDiv)
    layerBox.appendChild(layerBoxSeparatorDiv)
    layerBox.appendChild(layerBoxOverlayDiv)

    // fill color maps options
    for (let k = 0; k < ColorMap.MAPS_NAMES.length; k++) {
      let auxOpt = document.createElement("option")
      auxOpt.innerText = ColorMap.MAPS_NAMES[k]
      layerBoxCmapSelect.appendChild(auxOpt)
    }

    layerBoxCmapSelect.value = self.getBaseImageLayer().getColorMap().mapName

    // loop over all overlay layers
    var layers = this.view.allOverlayLayers;
    let ulElem = document.createElement("ul")
    for (let k = layers.length - 1; k >= 0; k--) {
      let liElem = document.createElement("li")
      let inputElem = document.createElement("input")
      let divElem = document.createElement("div")
      let labelElem = document.createElement("label")
      inputElem.type = "checkbox"
      
      var layer = layers[k];
      var name = layer.name;
      var tooltipText = "";
      var iconSvg = "";

      if (layer.isShowing) inputElem.checked = true

      if (layer.type === "catalog" || layer.type === "progressivecat") {
        var nbSources = layer.getSources().length;
        tooltipText = nbSources + " source" + (nbSources > 1 ? "s" : "");
        iconSvg = AladinUtils.SVG_ICONS.CATALOG;
      } else if (layer.type === "moc") {
        tooltipText = "Coverage: " + (100 * layer.skyFraction()).toFixed(3) + " % of sky";
        iconSvg = AladinUtils.SVG_ICONS.MOC;
      } else if (layer.type === "overlay") {
        iconSvg = AladinUtils.SVG_ICONS.OVERLAY;
      }

      // trick to retrieve the color as 'rgb(,,)' - does not work for named colors :(
      // var rgbColor = $("<div></div>").css("color", layer.color).css("color");
      // var labelColor = Color.getLabelColorForBackground(rgbColor);
      var labelColor = Color.getLabelColorForBackground(layer.color);

      // retrieve SVG icon, and apply the layer color
      let svgBase64 = window.btoa(iconSvg.replace(/FILLCOLOR/g, layer.color));
      divElem.classList.add("aladin-stack-icon")
      divElem.style.backgroundImage = `url("data:image/svg+xml;base64,${svgBase64}")`
      inputElem.id = `aladin_lite_${name}`
      labelElem.htmlFor = `aladin_lite_${name}`
      labelElem.classList.add("aladin-layer-label")
      labelElem.style.background = layer.color
      labelElem.style.color = labelColor
      labelElem.title = tooltipText
      labelElem.innerText = name
      liElem.appendChild(divElem)
      liElem.appendChild(inputElem)
      liElem.appendChild(labelElem)
      ulElem.appendChild(liElem)
      // handler to hide/show overlays
      inputElem.addEventListener("change", (e) => {
        if (e.target.checked) {
          layer.show()
        } else {
          layer.hide()
        }
      })
    }
    layerBox.appendChild(ulElem)

    let divElem = document.createElement("div")
    divElem.classList.add("aladin-blank-separator")
    layerBox.appendChild(divElem)

    // gestion du réticule
    let reticleInput = document.createElement("input")
    reticleInput.id = "displayReticle"
    reticleInput.type = "checkbox"
    if (this.view.displayReticle) reticleInput.checked = true
    let reticleLabel = document.createElement("label")
    reticleLabel.setAttribute("for", "displayReticle")
    reticleLabel.innerText = "Reticle"
    layerBox.appendChild(reticleInput)
    layerBox.appendChild(reticleLabel)
    reticleInput.addEventListener("change", (e) => self.showReticle(e.target.checked))

    // Gestion grille Healpix
    let hpxInput = document.createElement("input")
    hpxInput.id = "displayHpxGrid"
    hpxInput.type = "checkbox"
    if (this.view.displayHpxGrid) hpxInput.checked = true
    let hpxLabel = document.createElement("label")
    hpxLabel.setAttribute("for", "displayHpxGrid")
    hpxLabel.innerText = "HEALPix grid"
    layerBox.appendChild(hpxInput)
    layerBox.appendChild(hpxLabel)
    hpxInput.addEventListener("change", (e) => self.showHealpixGrid(e.target.checked))

    let layerBoxSeparator2 = document.createElement("div")
    layerBoxSeparator2.classList.add("aladin-box-separator")
    let layerBoxLabel2 = document.createElement("div")
    layerBoxLabel2.classList.add("aladin-label")
    layerBoxLabel2.innerText = "Tools"
    layerBox.appendChild(layerBoxSeparator2)
    layerBox.appendChild(layerBoxLabel2)
    let exportBtn = document.createElement("button")
    exportBtn.classList.add("aladin-btn")
    exportBtn.type = "button"
    exportBtn.innerText = "Export view as PNG"
    layerBox.appendChild(exportBtn)
    exportBtn.addEventListener("click", () => self.exportAsPNG())

    /*
      '<div class="aladin-box-separator"></div>' +
      '<div class="aladin-label">Projection</div>' +
      '<select id="projectionChoice"><option>SINUS</option><option>AITOFF</option></select><br/>'
    */

    let projectionChoice = document.getElementById("projectionChoice")
    if (projectionChoice) {
      projectionChoice.addEventListener("change", (e) => self.setProjection(e.target.value))
    }

    layerBoxCloseBtn.addEventListener("click", () => self.hideBoxes())

    // update list of surveys
    this.updateSurveysDropdownList(HpxImageSurvey.getAvailableSurveys());
    layerBoxSelect.addEventListener("change", (e) => {
      let survey = HpxImageSurvey.getAvailableSurveys()[e.target.selectedIndex];
      self.setImageSurvey(survey.id, () => {
        var baseImgLayer = self.getBaseImageLayer();

        if (baseImgLayer.useCors) {
          // update color map list with current value color map
          layerBoxCmapSelect.value = baseImgLayer.getColorMap().mapName
          layerBoxCmapDiv.style.display = "block"
          exportBtn.style.display = "block"
        } else {
          layerBoxCmapDiv.style.display = "none"
          exportBtn.style.display = "none"
        }
      })
    })

    //// COLOR MAP management ////////////////////////////////////////////
    // update color map
    layerBoxCmapSelect.addEventListener("change", (e) => {
      self.getBaseImageLayer().getColorMap().update(e.target.value);
    })

    // reverse color map
    layerBoxCmapBtn.addEventListener("click", () => {
      self.getBaseImageLayer().getColorMap().reverse();
    })

    if (this.getBaseImageLayer().useCors) {
      layerBoxCmapDiv.style.display = "block"
      exportBtn.style.display = "block"
    } else {
      layerBoxCmapDiv.style.display = "none"
      exportBtn.style.display = "none"
    }

    // ? parent or should be the same layerBoxCmapBtn
    layerBoxCmapInnerDiv.parentElement.disabled = true
    
    // Finally display
    layerBox.style.display = "block"
  };

  Aladin.prototype.layerByName = function (name) {
    var c = this.view.allOverlayLayers;
    for (var k = 0; k < c.length; k++) {
      if (name === c[k].name) {
        return c[k];
      }
    }
    return null;
  };

  // TODO : integrate somehow into API ?
  Aladin.prototype.exportAsPNG = function () {
    var w = window.open();
    w.document.write('<img src="' + this.getViewDataURL() + '">');
    w.document.title = "Aladin Lite snapshot";
  };

  /**
   * Return the current view as a data URL (base64-formatted string)
   * Parameters:
   * - options (optional): object with attributs
   *     * format (optional): 'image/png' or 'image/jpeg'
   *     * width: width in pixels of the image to output
   *     * height: height in pixels of the image to output
   *
   * @API
   */
  Aladin.prototype.getViewDataURL = function (optionsa) {
    var options = optionsa || {};
    // support for old API signature
    if (typeof options !== "object") {
      var imgFormat = options;
      options = { format: imgFormat };
    }

    return this.view.getCanvasDataURL(
      options.format,
      options.width,
      options.height
    );
  };

  /**
   * Return the current view WCS as a key-value dictionary
   * Can be useful in coordination with getViewDataURL
   *
   * @API
   */
  Aladin.prototype.getViewWCS = function () {
    var raDec = this.getRaDec();
    var fov = this.getFov();
    // TODO: support for other projection methods than SIN
    return {
      NAXIS: 2,
      NAXIS1: this.view.width,
      NAXIS2: this.view.height,
      RADECSYS: "ICRS",
      CRPIX1: this.view.width / 2,
      CRPIX2: this.view.height / 2,
      CRVAL1: raDec[0],
      CRVAL2: raDec[1],
      CTYPE1: "RA---SIN",
      CTYPE2: "DEC--SIN",
      CD1_1: fov[0] / this.view.width,
      CD1_2: 0.0,
      CD2_1: 0.0,
      CD2_2: fov[1] / this.view.height,
    };
  };

  /** restrict FOV range
   * @API
   * @param minFOV in degrees when zoom in at max
   * @param maxFOV in degreen when zoom out at max
   */
  Aladin.prototype.setFovRange = Aladin.prototype.setFOVRange = function (
    minFOV,
    maxFOV
  ) {
    if (minFOV > maxFOV) {
      var tmp = minFOV;
      minFOV = maxFOV;
      maxFOV = tmp;
    }

    this.view.minFOV = minFOV;
    this.view.maxFOV = maxFOV;
  };

  /**
   * Transform pixel coordinates to world coordinates
   *
   * Origin (0,0) of pixel coordinates is at top left corner of Aladin Lite view
   *
   * @API
   *
   * @param x
   * @param y
   *
   * @return a [ra, dec] array with world coordinates in degrees. Returns undefined is something went wrong
   *
   */
  Aladin.prototype.pix2world = function (x, y) {
    // this might happen at early stage of initialization
    if (!this.view) {
      return undefined;
    }

    var xy = AladinUtils.viewToXy(
      x,
      y,
      this.view.width,
      this.view.height,
      this.view.largestDim,
      this.view.zoomFactor
    );

    var radec;
    try {
      radec = this.view.projection.unproject(xy.x, xy.y);
    } catch (e) {
      return undefined;
    }

    var res;
    if (this.view.cooFrame === CooFrameEnum.GAL) {
      res = CooConversion.GalacticToJ2000([radec.ra, radec.dec]);
    } else {
      res = [radec.ra, radec.dec];
    }

    return res;
  };

  /**
   * Transform world coordinates to pixel coordinates in the view
   *
   * @API
   *
   * @param ra
   * @param dec
   *
   * @return a [x, y] array with pixel coordinates in the view. Returns null if the projection failed somehow
   *
   */
  Aladin.prototype.world2pix = function (ra, dec) {
    // this might happen at early stage of initialization
    if (!this.view) {
      return;
    }
    var xy;
    if (this.view.cooFrame === CooFrameEnum.GAL) {
      var lonlat = CooConversion.J2000ToGalactic([ra, dec]);
      xy = this.view.projection.project(lonlat[0], lonlat[1]);
    } else {
      xy = this.view.projection.project(ra, dec);
    }
    if (xy) {
      var xyview = AladinUtils.xyToView(
        xy.X,
        xy.Y,
        this.view.width,
        this.view.height,
        this.view.largestDim,
        this.view.zoomFactor
      );
      return [xyview.vx, xyview.vy];
    } else {
      return null;
    }
  };

  /**
   *
   * @API
   *
   * @param ra
   * @param nbSteps the number of points to return along each side (the total number of points returned is 4*nbSteps)
   *
   * @return set of points along the current FoV with the following format: [[ra1, dec1], [ra2, dec2], ..., [ra_n, dec_n]]
   *
   */
  Aladin.prototype.getFovCorners = function (nbSteps) {
    // default value: 1
    if (!nbSteps || nbSteps < 1) {
      nbSteps = 1;
    }

    var points = [];
    var x1, y1, x2, y2;
    for (var k = 0; k < 4; k++) {
      x1 = k === 0 || k === 3 ? 0 : this.view.width - 1;
      y1 = k < 2 ? 0 : this.view.height - 1;
      x2 = k < 2 ? this.view.width - 1 : 0;
      y2 = k === 1 || k === 2 ? this.view.height - 1 : 0;

      for (var step = 0; step < nbSteps; step++) {
        points.push(
          this.pix2world(
            x1 + (step / nbSteps) * (x2 - x1),
            y1 + (step / nbSteps) * (y2 - y1)
          )
        );
      }
    }

    return points;
  };

  /**
   * @API
   *
   * @return the current FoV size in degrees as a 2-elements array
   */
  Aladin.prototype.getFov = function () {
    var fovX = this.view.fov;
    var s = this.getSize();
    var fovY = (s[1] / s[0]) * fovX;
    // TODO : take into account AITOFF projection where fov can be larger than 180
    fovX = Math.min(fovX, 180);
    fovY = Math.min(fovY, 180);

    return [fovX, fovY];
  };

  /**
   * @API
   *
   * @return the size in pixels of the Aladin Lite view
   */
  Aladin.prototype.getSize = function () {
    return [this.view.width, this.view.height];
  };

  /**
   * @API
   *
   * @return the jQuery object representing the DIV element where the Aladin Lite instance lies
   */
  Aladin.prototype.getParentDiv = function () {
    return this.aladinDiv;
  };

  return Aladin;
})();

//// New API ////
// For developers using Aladin lite: all objects should be created through the API,
// rather than creating directly the corresponding JS objects
// This facade allows for more flexibility as objects can be updated/renamed harmlessly

// @API
/*
 * return a Box GUI element to insert content
 */
Aladin.prototype.box = function (options) {
  const box = new Box(options);
  this.aladinDiv.append(box.$parentDiv);

  return box;
};

// @API
/*
 * show popup at ra, dec position with given title and content
 */
Aladin.prototype.showPopup = function (ra, dec, title, content) {
  this.view.catalogForPopup.removeAll();
  const lmarker = marker(ra, dec, {
    popupTitle: title,
    popupDesc: content,
    useMarkerDefaultIcon: false,
  });
  this.view.catalogForPopup.addSources(lmarker);
  this.view.catalogForPopup.show();

  this.view.popup.setTitle(title);
  this.view.popup.setText(content);
  this.view.popup.setSource(lmarker);
  this.view.popup.show();
};

// @API
/*
 * hide popup
 */
Aladin.prototype.hidePopup = function () {
  this.view.popup.hide();
};

// @API
/*
 * return a URL allowing to share the current view
 */
Aladin.prototype.getShareURL = function () {
  var radec = this.getRaDec();
  var coo = new Coo();
  coo.prec = 7;
  coo.lon = radec[0];
  coo.lat = radec[1];

  return (
    "http://aladin.unistra.fr/AladinLite/?target=" +
    encodeURIComponent(coo.format("s")) +
    "&fov=" +
    this.getFov()[0].toFixed(2) +
    "&survey=" +
    encodeURIComponent(
      this.getBaseImageLayer().id || this.getBaseImageLayer().rootUrl
    )
  );
};

// @API
/*
 * return, as a string, the HTML embed code
 */
Aladin.prototype.getEmbedCode = function () {
  var radec = this.getRaDec();
  var coo = new Coo();
  coo.prec = 7;
  coo.lon = radec[0];
  coo.lat = radec[1];

  var survey = this.getBaseImageLayer().id;
  var fov = this.getFov()[0];
  var s = "";
  s +=
    '<link rel="stylesheet" href="http://aladin.unistra.fr/AladinLite/api/v2/latest/aladin.min.css" />\n';
  s +=
    '<script type="text/javascript" src="//code.jquery.com/jquery-1.9.1.min.js" charset="utf-8"></script>\n';
  s += '<div id="aladin-lite-div" style="width:400px;height:400px;"></div>\n';
  s +=
    '<script type="text/javascript" src="http://aladin.unistra.fr/AladinLite/api/v2/latest/aladin.min.js" charset="utf-8"></script>\n';
  s += '<script type="text/javascript">\n';
  s +=
    'var aladin = aladin("#aladin-lite-div", {survey: "' +
    survey +
    'P/DSS2/color", fov: ' +
    fov.toFixed(2) +
    ', target: "' +
    coo.format("s") +
    '"});\n';
  s += "</script>";
  return s;
};

// @API
/*
 * Creates remotely a HiPS from a FITS image URL and displays it
 */
Aladin.prototype.displayFITS = function (
  url,
  options,
  successCallback,
  errorCallback
) {
  options = options || {};
  var data = { url: url };
  if (options.color) {
    data.color = true;
  }
  if (options.outputFormat) {
    data.format = options.outputFormat;
  }
  if (options.order) {
    data.order = options.order;
  }
  if (options.nocache) {
    data.nocache = options.nocache;
  }
  var self = this;

  // I don't know who trigger this function, so I can't test this is working
  fetch("https://alasky.unistra.fr/cgi/fits2HiPS", {
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(data => {
    // if (response.status !== "success") {
    //   console.error("An error occured: " + response.message);
    //   if (errorCallback) {
    //     errorCallback(response.message);
    //   }
    //   return;
    // }
    var label = options.label || "FITS image";
    var meta = data.data.meta;
    self.setOverlayImageLayer(
      self.createImageSurvey(
        label,
        label,
        data.data.url,
        "equatorial",
        meta.max_norder,
        { imgFormat: "png" }
      )
    );
    var transparency = (options && options.transparency) || 1.0;
    self.getOverlayImageLayer().setAlpha(transparency);

    var executeDefaultSuccessAction = true;
    if (successCallback) {
      executeDefaultSuccessAction = successCallback(
        meta.ra,
        meta.dec,
        meta.fov
      );
    }
    if (executeDefaultSuccessAction === true) {
      self.gotoRaDec(meta.ra, meta.dec);
      self.setFoV(meta.fov);
    }
  })
  .catch(err => {
    console.log(err)
    if (typeof errorCallback === "function")
      errorCallback(err)
  })
  // $.ajax({
  //   url: "https://alasky.unistra.fr/cgi/fits2HiPS",
  //   data: data,
  //   method: "POST",
  //   dataType: "json",
  //   success: function (response) {
  //     if (response.status !== "success") {
  //       console.error("An error occured: " + response.message);
  //       if (errorCallback) {
  //         errorCallback(response.message);
  //       }
  //       return;
  //     }
  //     var label = options.label || "FITS image";
  //     var meta = response.data.meta;
  //     self.setOverlayImageLayer(
  //       self.createImageSurvey(
  //         label,
  //         label,
  //         response.data.url,
  //         "equatorial",
  //         meta.max_norder,
  //         { imgFormat: "png" }
  //       )
  //     );
  //     var transparency = (options && options.transparency) || 1.0;
  //     self.getOverlayImageLayer().setAlpha(transparency);

  //     var executeDefaultSuccessAction = true;
  //     if (successCallback) {
  //       executeDefaultSuccessAction = successCallback(
  //         meta.ra,
  //         meta.dec,
  //         meta.fov
  //       );
  //     }
  //     if (executeDefaultSuccessAction === true) {
  //       self.gotoRaDec(meta.ra, meta.dec);
  //       self.setFoV(meta.fov);
  //     }
  //   },
  // });
};

// @API
/*
 * Creates remotely a HiPS from a JPEG or PNG image with astrometry info
 * and display it
 */
Aladin.prototype.displayJPG = Aladin.prototype.displayPNG = function (
  url,
  options,
  successCallback,
  errorCallback
) {
  options = options || {};
  options.color = true;
  options.label = "JPG/PNG image";
  options.outputFormat = "png";
  this.displayFITS(url, options, successCallback, errorCallback);
};

Aladin.prototype.setReduceDeformations = function (reduce) {
  this.reduceDeformations = reduce;
  this.view.requestRedraw();
};

// conservé pour compatibilité avec existant
// @oldAPI
// if ($) {
//     $.aladin = A.aladin;
// }
//
// TODO: callback function onAladinLiteReady
//
export default Aladin;
