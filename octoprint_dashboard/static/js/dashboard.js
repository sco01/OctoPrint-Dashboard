/*
 * View model for OctoPrint-Dashboard
 *
 * Authors: Jefferey Neuffer (https://github.com/j7126), Will MacCormack (https://github.com/willmac16), Stefan Cohen (https://github.com/StefanCohen), CynanX
 * 
 * Copyright (C) 2024
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
$(function () {
    function DashboardViewModel(parameters) {
        var self = this;

        //Viewmodels
        self.temperatureModel = parameters[0];
        self.printerStateModel = parameters[1];
        self.printerProfilesModel = parameters[2];
        self.connectionModel = parameters[3];
        self.settingsViewModel = parameters[4];
        self.controlViewModel = parameters[5];
        self.enclosureViewModel = parameters[6];
        self.loginState = parameters[7];

        //Settings
        self.dashboardSettings = null;

        self.commandWidgetArray = null;

        //Dashboard layer progress vars
        self.layerAnalysisError = ko.observable(false)
        self.layerProgress = ko.observable("-");
        self.totalLayer = ko.observable("-");
        self.currentLayer = ko.observable("-");
        self.currentHeight = ko.observable("-");
        self.totalMoves = ko.observable("-");
        self.timeToNextChange = ko.observable("-");
        self.totalHeight = ko.observable("-");
        self.fanSpeed = ko.observable(0);
        self.lastLayerDuration = ko.observable("-");
        self.lastLayerDurationInSeconds = ko.observable("-");
        self.averageLayerDuration = ko.observable("-");
        self.changeFilamentCount = ko.observable("-");

        self.feedrate = ko.observable(0);
        self.feedrateAv = ko.observable(0);
        self.feedrateAvLastFiveSeconds = ko.observable(0);
        self.feedrateLastFiveSeconds = [];

        //Dashboard backend vars
        self.getEta = ko.observable();
        self.extrudedFilament = ko.observable(0.00);
        self.timeProgressString = ko.observable(0.01);
        self.timeProgressBarString = ko.observable("0%");
        self.heightProgressString = ko.observable(0.01);
        self.heightProgressBarString = ko.observable("0%");
        self.printerMessage = ko.observable("");
        self.cpuPercent = ko.observable(0);
        self.cpuFreq = ko.observable(0);
        self.virtualMemPercent = ko.observable(0);
        self.diskUsagePercent = ko.observable(0);
        self.cpuTemp = ko.observable(0);
        // self.commandWidgetArray = ko.observableArray();
        self.cmdResults = ko.observableArray();
        self.webcamState = ko.observable(0);
        self.rotate = ko.observable(0);
        self.flipH = ko.observable(0);
        self.flipV = ko.observable(0);
        self.isFull = ko.observable(false);

        self.webcamHlsEnabled = ko.observable(false);
        self.webcamMjpgEnabled = ko.observable(true);

        self.accentColor = ko.observable("#08c");
        self.textColor = ko.observable("#000");

        // 3/4 Gauge Rendering vars
        self.tempGaugeAngle = ko.observable(260);
        self.tempGaugeRadius = ko.observable(77);
        self.tempGaugeOffset = ko.observable(53);
        self.tempGaugeTicks = ko.observableArray([0.0, 0.25, 0.5, 0.75, 1.0]);

        self.admin = ko.observableArray(false);
        self.webcam_perm = ko.observable(false);
        self.hls_capable = ko.observable(false);


        // Widget registry, filled in onBeforeBinding: self.widgets is the ordered list, self.widget looks one up by id
        self.widgets = [];
        self.widget = {};


        self.hls;

        //Scale down the file name if it is too long to fit one line #This should probably be placed somewhere else
        self.fitties = fitty('#fileInfo', { minSize: 2, maxSize: 20 });

        //Fullscreen
        self.urlParams = new URLSearchParams(window.location.search);
        var dashboardIsFull = self.urlParams.has('dashboard') && (self.urlParams.get('dashboard') == 'full');

        self.bindingDone = false;

        self.layerGraph;

        self.currentTab = '';

        self.chartWidth = 98;

        //Themeify coloring
        self.RefreshThemeColors = function () {
            var theme;
            try {
                theme = self.settingsViewModel.settings.plugins.themeify.theme();
                if (self.settingsViewModel.settings.plugins.themeify.enabled() == false) {
                    theme = '';
                }
            } catch { }

            switch (theme) {
                case 'discorded':
                    self.accentColor('#7289da');
                    break;
                case 'material_ui_light':
                    self.accentColor('#2196f3');
                    break;
                case 'cyborg':
                    self.accentColor('#33b5e5');
                    break;
                case 'discoranged':
                    self.accentColor('#fc8003');
                    break;
                case 'dyl':
                    self.accentColor('#ff9800');
                    break;
                case 'nighttime':
                    self.accentColor('#0073ff');
                    break;
                default:
                    self.accentColor('#08c');
                    break;
            }

            if ($(":root").css("--accent")) {
                self.accentColor($(":root").css("--accent"));
            }

            // if user doesn't want theming to change colors, then don't change them
            if (self.dashboardSettings.useThemeifyColor() == false) {
                self.accentColor('#08c');
            }

            self.textColor($('body').css("color"));
        }

        self.getToggleFullBrowserWindowHref = function () {
            var urlParams = new URLSearchParams(self.urlParams);
            if (!dashboardIsFull) {
                urlParams.set('dashboard', 'full');
            } else {
                urlParams.delete('dashboard');
            }
            return "?" + urlParams.toString() + "#tab_plugin_dashboard";
        }

        self.toggleFullBrowserWindow = function () {
            if (!dashboardIsFull) {
                //location.href="/#tab_plugin_dashboard/?dashboard=full";
                history.replaceState(null, null, ' ');
                self.urlParams.set('dashboard', 'full');
                window.location.hash = 'tab_plugin_dashboard';
                window.location.search = self.urlParams;
            } else {
                self.urlParams.delete('dashboard');
                window.location.search = self.urlParams;
                //self.urlParams.delete('dashboard');
            }
        }


        // Fullscreen
        self.fullScreen = function () {
            var elem = document.body;
            if (elem.requestFullscreen) {
                if (!document.fullscreenElement) {
                    elem.requestFullscreen();
                    self.isFull(true);
                    $('#dashboardContainer').addClass('dashboard-full');
                    $('body').css('overflow', 'hidden');
                    if (self.dashboardSettings.fullscreenUseThemeColors()) {
                        document.getElementById('dashboardContainer').style.setProperty('color', 'inherit', 'important');
                        $('#dashboardContainer').css('background-color', 'inherit');
                        $('#dashboardContainer').parents(':not(html):not(body)').css('background-color', 'inherit');
                    }
                } else if (document.exitFullscreen) {
                    document.exitFullscreen();
                    self.isFull(false);
                    if (!dashboardIsFull) {
                        $('#dashboardContainer').removeClass('dashboard-full');
                        $('body').css('overflow', '');
                        if (self.dashboardSettings.fullscreenUseThemeColors()) {
                            $('#dashboardContainer').css('background-color', '');
                            $('#dashboardContainer').parents(':not(html):not(body)').css('background-color', '');
                            $('#dashboardContainer').css('color', '');
                        }
                    }
                }
            }
            return
        }

        if (!dashboardIsFull) {
            document.onfullscreenchange = function (event) {
                if (self.dashboardSettings.fullscreenUseThemeColors()) {
                    var elem = document.body;
                    if (elem.requestFullscreen) {
                        if (!document.fullscreenElement) {
                            self.isFull(false);
                            $('#dashboardContainer').css('background-color', '');
                            $('#dashboardContainer').parents(':not(html):not(body)').css('background-color', '');
                            $('#dashboardContainer').css('color', '');
                            $('#dashboardContainer').removeClass('dashboard-full');
                            $('body').css('overflow', '');
                        } else {
                            self.isFull(true);
                            document.getElementById('dashboardContainer').style.setProperty('color', 'inherit', 'important');
                            $('#dashboardContainer').css('background-color', 'inherit');
                            $('#dashboardContainer').parents(':not(html):not(body)').css('background-color', 'inherit');
                        }
                    }
                } else {
                    var elem = document.body;
                    if (elem.requestFullscreen) {
                        if (!document.fullscreenElement) {
                            self.isFull(false);
                            $('#dashboardContainer').removeClass('dashboard-full');
                            $('body').css('overflow', '');
                        } else {
                            self.isFull(true);
                        }
                    }
                }
            };
        }

        self.onDataUpdaterPluginMessage = function (plugin, data) {
            if (plugin == "dashboard") {
                // Layer
                if (data.totalLayers) { self.totalLayer(data.totalLayers); }
                if (data.currentLayer) { self.currentLayer(data.currentLayer); }
                if (data.layerProgress) { self.layerProgress(data.layerProgress); }
                if (data.layerAnalysisError) {
                    let lae = data.layerAnalysisError.replace(/[\[\]]/g, '');
                    lae = lae.split(", ");
                    data.layerAnalysisError = false;
                    lae.forEach(item => {
                        if (item == 'True')
                            data.layerAnalysisError = true;
                    });
                    self.layerAnalysisError(data.layerAnalysisError);
                }

                // Height
                if (data.maxZ) { self.totalHeight(Number(data.maxZ).toFixed(2)); }
                if (data.currentHeight) {
                    self.currentHeight(data.currentHeight);

                    if (self.totalHeight() > 0) {
                        self.heightProgressString(self.currentHeight() / self.totalHeight() * 100);
                        self.heightProgressBarString(Math.round(self.heightProgressString()) + '%');
                    }
                }

                // Feedrate
                if (data.currentFeedrate && self.dashboardSettings.showFeedrate()) {
                    // calculate last 5 seconds average
                    self.feedrateLastFiveSeconds.push(data.currentFeedrate);
                    self.feedrateAvLastFiveSeconds((self.feedrateLastFiveSeconds.reduce((a, b) => a + b, 0) / self.feedrateLastFiveSeconds.length) || 0);
                    setTimeout(() => {
                        self.feedrateLastFiveSeconds.shift();
                        self.feedrateAvLastFiveSeconds((self.feedrateLastFiveSeconds.reduce((a, b) => a + b, 0) / self.feedrateLastFiveSeconds.length) || 0);
                    }, 5000);

                    // limit everything by max feedrate
                    if (data.currentFeedrate > self.dashboardSettings.feedrateMax()) {
                        self.feedrate(self.dashboardSettings.feedrateMax());
                    } else {
                        self.feedrate(data.currentFeedrate);
                    }

                    if (data.avgFeedrate > self.dashboardSettings.feedrateMax()) {
                        self.feedrateAv(self.dashboardSettings.feedrateMax());
                    } else {
                        self.feedrateAv(data.avgFeedrate);
                    }

                    if (self.feedrateAvLastFiveSeconds() > self.dashboardSettings.feedrateMax()) {
                        self.feedrateAvLastFiveSeconds(self.dashboardSettings.feedrateMax());
                    }
                }

                // Fan Speed
                if (data.fanSpeed) { self.fanSpeed(data.fanSpeed); }

                // Layer Duration Data
                if (data.lastLayerDuration) { self.lastLayerDuration(data.lastLayerDuration); }
                if (data.lastLayerDurationInSeconds) { self.lastLayerDurationInSeconds(data.lastLayerDurationInSeconds); }
                if (data.averageLayerDuration) { self.averageLayerDuration(data.averageLayerDuration); }

                // System Stats handling
                if (data.cpuPercent) { self.cpuPercent(data.cpuPercent); }
                if (data.cpuFreq) { self.cpuFreq(data.cpuFreq); }
                if (data.virtualMemPercent) { self.virtualMemPercent(data.virtualMemPercent); }
                if (data.diskUsagePercent) { self.diskUsagePercent(data.diskUsagePercent); }
                if (data.cpuTemp) { self.cpuTemp(data.cpuTemp); }

                // printer message handling
                if (data.printerMessage) { self.printerMessage(data.printerMessage); }

                // Filament handling
                if (data.totalMoves) { self.totalMoves(data.totalMoves); }
                if (data.extrudedFilament) { self.extrudedFilament(data.extrudedFilament); }
                if (data.timeToNextChange) { self.timeToNextChange(data.timeToNextChange); }


                // TODO: only send necessary layer labels
                if (data.layerTimes && data.layerLabels) { self.renderChart(data.layerTimes, data.layerLabels); }


                if (data.printStarted) { self.printStarted(); }
                if (data.printEnd) { self.printEnd(); }

                // Cmd Widget Handling
                if (data.cmdResults) {
                    resultUpdates = JSON.parse(data.cmdResults);
                    results = self.cmdResults();
                    results[resultUpdates["index"]] = resultUpdates["result"];
                    self.cmdResults(results);
                }
                if (data.cmdTest) {
                    testResult = JSON.parse(data.cmdTest);


                    printerDisplay = new PNotify({
                        title: 'Dashboard',
                        type: 'info',
                        text: `Command Widget Test Result: ${_.escape(testResult["result"])}`,
                        hide: false
                    });
                }

            }
        };


        self.printStarted = function () {
            if (self.dashboardSettings.clearOn_PrinterMessage() == 1) {
                self.printerMessage('');
            }
            if (self.dashboardSettings.clearOn_LayerGraph() == 1) {
                self.renderChart('[]', '[]');
            }
            if (self.dashboardSettings.clearOn_Filament() == 1) {
                self.extrudedFilament(0.00);
            }
            if (self.dashboardSettings.clearOn_Feedrate() == 1) {
                self.feedrate(0);
                self.feedrateAv(0);
                self.feedrateAvLastFiveSeconds(0);
                self.feedrateLastFiveSeconds = [];
            }

            if (self.dashboardSettings.showPrintThumbnail()) {
                self.updatePrintThumbnail();
            }

            self.layerProgress(0);
            self.currentHeight(0);
            self.currentLayer(0);
        };

        self.printEnd = function () {
            if (self.dashboardSettings.clearOn_PrinterMessage() == 2) {
                self.printerMessage('');
            }
            if (self.dashboardSettings.clearOn_LayerGraph() == 2) {
                self.renderChart('[]', '[]');
            }
            if (self.dashboardSettings.clearOn_Filament() == 2) {
                self.extrudedFilament(0.00);
            }
            if (self.dashboardSettings.clearOn_Feedrate() == 2) {
                self.feedrate(0);
                self.feedrateAv(0);
                self.feedrateAvLastFiveSeconds(0);
                self.feedrateLastFiveSeconds = [];
            }
            if (self.dashboardSettings.clearOn_PrintThumbnail() == 2)
                $("#dashboard_print_thumbnail").remove()
            self.layerProgress(0);
            self.heightProgressBarString("0%");
            self.heightProgressString(0.01);
            return;
        };

        self.cpuTempColor = function () {
            if (self.cpuTemp() >= self.dashboardSettings.cpuTempCriticalThreshold()) {
                return "red";
            } else if (self.cpuTemp() >= self.dashboardSettings.cpuTempWarningThreshold()) {
                return "orange";
            } else if (self.cpuTemp() < self.dashboardSettings.cpuTempWarningThreshold()) {
                return self.accentColor();
            }
        }

        self.tempColor = function (actual, target) {
            if (self.dashboardSettings.showTempGaugeColors() == true) {
                if (target == 0) {
                    return "#08c";
                } else if (parseInt(target) > 0) {
                    if (parseInt(actual) < parseInt(target) - parseInt(self.dashboardSettings.targetTempDeviation())) {
                        //console.log("Less than set temp!");
                        return "#08c"; //blue
                    } else if (parseInt(actual) > parseInt(target) + parseInt(self.dashboardSettings.targetTempDeviation())) {
                        //console.log("Above set temp!");
                        return "#ff3300"; //red
                    } else return "#28b623"; //green

                }
            } else return self.accentColor();
        }

        self.switchToDefaultWebcam = function () {
            self._switchWebcam(self.dashboardSettings.defaultWebcam() + 1);
        };

        // --- Widget ForEach prep ---
        self.widgetTypes = {
            THREE_QUARTER: '3/4',
            PROGRESS: 'progress',
            TIME: 'time',
            CURRENT_OF_TOTAL: 'currentOfTotal',
            TEXT: 'text',
            GRAPH: 'graph'
            // Add Feedrate Style gague
        };

        self.castToWidgetTypes = function (value) {
            let lower = String(value).toLowerCase();
            for (const source in self.widgetTypes) {
                if (lower === self.widgetTypes[source]) {
                    return self.widgetTypes[source];
                }
            }

            return "NONE";
        }

        self.onBeforeBinding = function () {
            self.dashboardSettings = self.settingsViewModel.settings.plugins.dashboard;
            var dashboardSettings = self.dashboardSettings;
            // self.commandWidgetArray(self.dashboardSettings.commandWidgetArray());

            self.commandWidgetArray = self.dashboardSettings.commandWidgetArray;

            // --- Widget registry ---
            // One entry per widget, in the order they appear in settings. Besides id and title, an entry names the
            // plugin settings that control it:
            //   show: shown at all (can instead be a function, with enable and disable functions, see Progress Gauges)
            //   full: also shown in fullscreen and full browser window
            //   printingOnly: only shown while printing
            //   clearOn: when its data is cleared (1 = print start, 2 = print end)
            // Extra settings for the settings page can be added in one of two ways (ONLY ONE PER WIDGET):
            //   settings: an array of radio, checkbox or title settings, see Progress Gauges and Filament Widget
            //   settingsId: the id (with a #) of a modal in the settings page jinja template
            var definitions = [
                { id: "fullscreenButtons", title: gettext("FullScreen & FullBrowser Mode Buttons"), show: "showFullscreen" },
                { id: "systemInfo", title: gettext("System Info"), show: "showSystemInfo", full: "fsSystemInfo", printingOnly: "printingOnly_SystemInfo", settingsId: "#dashboardSysInfoSettingsModal" },
                { id: "status", title: gettext("Status"), show: "showStatus", full: "fsStatus", printingOnly: "printingOnly_Status" },
                { id: "jobControlButtons", title: gettext("Job Control Buttons"), show: "showJobControlButtons", full: "fsJobControlButtons", printingOnly: "printingOnly_JobControlButtons" },
                { id: "tempGauges", title: gettext("Temperature Gauges"), show: "enableTempGauges", full: "fsTempGauges", printingOnly: "printingOnly_TempGauges", settingsId: "#dashboardTempGaugeSettingsModal" },
                { id: "fan", title: gettext("Fan Gauge"), show: "showFan", full: "fsFan", printingOnly: "printingOnly_Fan" },
                {
                    id: "sensorInfo",
                    title: gettext("Enclosure Gauges"),
                    show: "showSensorInfo",
                    full: "fsSensorInfo",
                    printingOnly: "printingOnly_SensorInfo",
                    settings: [
                        { type: "radio", title: gettext("Enclosure Plugin Gague Style"), setting: dashboardSettings.enclosureGaugeStyle, options: [{ name: gettext("Temperature Dial"), value: "3/4" }, { name: gettext("Text"), value: "text" }] }
                    ]
                },
                { id: "printThumbnail", title: gettext("Print Thumbnail (Slicer Thumbnails)"), show: "showPrintThumbnail", full: "fsPrintThumbnail", clearOn: "clearOn_PrintThumbnail" },
                { id: "commandWidgets", title: gettext("Command Widgets"), show: "showCommandWidgets", full: "fsCommandWidgets", printingOnly: "printingOnly_CommandWidgets", settingsId: "#dashboardCommandSettingsModal" },
                { id: "printerMessage", title: gettext("Printer Message (M117)"), show: "showPrinterMessage", full: "fsPrinterMessage", printingOnly: "printingOnly_PrinterMessage", clearOn: "clearOn_PrinterMessage" },
                {
                    id: "progressGauges",
                    title: gettext("Progress Gauges"),
                    show: function () {
                        return dashboardSettings.showTimeProgress() || dashboardSettings.showProgress() || dashboardSettings.showLayerProgress() || dashboardSettings.showHeightProgress();
                    },
                    enable: function () {
                        dashboardSettings.showTimeProgress(true);
                        dashboardSettings.showProgress(true);
                        dashboardSettings.showLayerProgress(true);
                        dashboardSettings.showHeightProgress(true);
                    },
                    disable: function () {
                        dashboardSettings.showTimeProgress(false);
                        dashboardSettings.showProgress(false);
                        dashboardSettings.showLayerProgress(false);
                        dashboardSettings.showHeightProgress(false);
                    },
                    full: "fsProgressGauges",
                    printingOnly: "printingOnly_ProgressGauges",
                    settings: [
                        { type: "radio", title: gettext("Progress gauge type"), setting: dashboardSettings.gaugetype, options: [{ name: gettext("Circle"), value: "circle" }, { name: gettext("Bar"), value: "bar" }] },
                        { type: "checkbox", title: gettext("Show Time Progress Gauge"), setting: dashboardSettings.showTimeProgress },
                        { type: "checkbox", title: gettext("Show GCode Progress Gauge"), setting: dashboardSettings.showProgress },
                        { type: "checkbox", title: gettext("Show Layer Progress Gauge"), setting: dashboardSettings.showLayerProgress },
                        { type: "checkbox", title: gettext("Show Height Progress Gauge"), setting: dashboardSettings.showHeightProgress }
                    ]
                },
                {
                    id: "layerGraph",
                    title: gettext("Layer Duration Graph"),
                    show: "showLayerGraph",
                    full: "fsLayerGraph",
                    printingOnly: "printingOnly_LayerGraph",
                    clearOn: "clearOn_LayerGraph",
                    settings: [
                        { type: "radio", title: gettext("Layer graph type"), setting: dashboardSettings.layerGraphType, options: [{ name: gettext("Normal"), value: "normal" }, { name: gettext("Last 40 Layers"), value: "last40layers" }, { name: gettext("Scrolling"), value: "scrolling" }] }
                    ]
                },
                { id: "fileName", title: gettext("File Name"), show: "showFileName", full: "fsFileName", printingOnly: "printingOnly_FileName" },
                {
                    id: "filament",
                    title: gettext("Filament Widget"),
                    show: "showFilament",
                    full: "fsFilament",
                    printingOnly: "printingOnly_Filament",
                    clearOn: "clearOn_Filament",
                    settings: [
                        { type: "title", title: gettext("The filament widget shows how much filament has been extruded. It can also show the time untill next filament change.") },
                        { type: "checkbox", title: gettext("Show time untill next filament change"), setting: dashboardSettings.showFilamentChangeTime }
                    ]
                },
                { id: "feedrate", title: gettext("Feedrate"), show: "showFeedrate", full: "fsFeedrate", printingOnly: "printingOnly_Feedrate", clearOn: "clearOn_Feedrate", settingsId: "#dashboardFeedrateSettingsModal" },
                { id: "timeEstimate", title: gettext("Time Estimate"), show: "showTimeEstimate", full: "fsTimeEstimate", printingOnly: "printingOnly_TimeEstimate" },
                { id: "layerInfo", title: gettext("Layer Info"), show: "showLayerInfo", full: "fsLayerInfo", printingOnly: "printingOnly_LayerInfo" },
                { id: "webcam", title: gettext("Webcam"), show: "showWebCam", full: "fsWebCam", printingOnly: "printingOnly_WebCam", settingsId: "#dashboardWebcamSettingsModal" }
            ];

            self.widgets = definitions.map(self.createWidget);
            self.widgets.forEach(function (widget) {
                self.widget[widget.id] = widget;
            });
        };

        // Turns a registry definition into a widget. The settings page binds to enabled, enableInFull, printingOnly
        // and clearOn, and tests whether they exist, so they are only set when the definition has them.
        // The tab binds to the computed observables:
        //   inLayout: enabled, and allowed in fullscreen when the dashboard is fullscreen
        //   printingOk: not limited to printing, or a print is running
        //   shown: both of the above
        self.createWidget = function (definition) {
            var dashboardSettings = self.dashboardSettings;
            var widget = { id: definition.id, title: definition.title };

            widget.enabled = typeof definition.show == "function" ? definition.show : dashboardSettings[definition.show];
            if (definition.enable) {
                widget.enable = definition.enable;
                widget.disable = definition.disable;
            }
            if (definition.full)
                widget.enableInFull = dashboardSettings[definition.full];
            if (definition.printingOnly)
                widget.printingOnly = dashboardSettings[definition.printingOnly];
            if (definition.clearOn)
                widget.clearOn = dashboardSettings[definition.clearOn];
            if (definition.settings)
                widget.settings = definition.settings;
            if (definition.settingsId)
                widget.settingsId = definition.settingsId;

            widget.inLayout = ko.pureComputed(function () {
                return widget.enabled() && (!self.isFull() || !widget.enableInFull || widget.enableInFull());
            });
            widget.printingOk = ko.pureComputed(function () {
                return !widget.printingOnly || !widget.printingOnly() || self.printerStateModel.isPrinting();
            });
            widget.shown = ko.pureComputed(function () {
                return widget.inLayout() && widget.printingOk();
            });
            return widget;
        };

        self.enableWidget = function (widget) {
            if (widget.enable != null)
                widget.enable();
            else {
                widget.enabled(true)
            };
        };

        self.disableWidget = function (widget) {
            if (widget.disable != null)
                widget.disable();
            else {
                widget.enabled(false)
            };
        };

        self.onAfterBinding = function () {
            self.bindingDone = true;
        };

        self.updatePrintThumbnail = function () {
            $('#dashboard_print_thumbnail').remove();
            thumbnail = $('#prusaslicer_state_thumbnail');
            if (thumbnail) {
                clone = thumbnail.clone();
                clone.attr("id", "dashboard_print_thumbnail");
                clone.appendTo($('.dashboardGridItem.thumbnailContainer'));
            }
        }

        self.doTempGaugeTicks = function () {
            var tempTicks = [];
            var temperatureTicks = self.dashboardSettings.temperatureTicks();
            if (temperatureTicks == 1) {
                temperatureTicks = 0;
            }

            for (i = 0; i < temperatureTicks; i++) {
                tempTicks.push(i / (temperatureTicks - 1));
            }

            self.tempGaugeTicks(tempTicks);
        };

        self.onSettingsBeforeSave = function () {
            if (self.webcam_perm) {
                self.switchToDefaultWebcam();
            }

            // console.log("before applying cmd widget array");
            // self.commandWidgetArray(self.dashboardSettings.commandWidgetArray());
            // console.log("after applying cmd widget array");

            self.doTempGaugeTicks();
            self.RefreshThemeColors();
            setTimeout(() => {
                self.RefreshThemeColors();
            }, 5000);
        };

        // self.fromCurrentData = function (data) {
        //     // console.log(data);
        // }

        // --- WEBCAM STUFF ---
        self.toggleWebcam = function () {
            if (self.webcamState() === 0) {
                self.switchToDefaultWebcam();
            } else {
                self._switchWebcam(0);
            }
        };

        self._disableWebcam = function () {
            var webcamImage = $("#dashboard_webcam_mjpg");

            webcamImage.attr("src", "");
            if (self.hls) {
                self.hls.destroy();
            }

            self.webcamHlsEnabled(false);
            self.webcamMjpgEnabled(false);
        }

        // Webcam mode switching functions adapted from octoprint control tab
        self._switchToMjpgWebcam = function (webcamUrl, nonce) {
            var webcamImage = $("#dashboard_webcam_mjpg");

            webcamImage.attr("src", webcamUrl + nonce);
            if (self.hls) {
                self.hls.destroy();
            }

            self.webcamHlsEnabled(false);
            self.webcamMjpgEnabled(true);
        };

        self._switchToHlsWebcam = function (webcamUrl) {
            var video = document.getElementById("dashboard_webcam_hls");

            if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = webcamUrl;
            } else if (Hls.isSupported()) {
                self.hls = new Hls();
                self.hls.loadSource(webcamUrl);
                self.hls.attachMedia(video);
            }

            $('#dashboard_webcam_mjpg').attr('src', "")

            self.webcamMjpgEnabled(false);
            self.webcamHlsEnabled(true);
        };

        const webcamLoadingIcon = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8' standalone='no'%3F%3E%3Csvg xmlns:svg='http://www.w3.org/2000/svg' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' version='1.0' width='128px' height='128px' viewBox='-256 -256 640 640' xml:space='preserve'%3E%3Cg%3E%3Ccircle cx='16' cy='64' r='16' fill='%23000000' fill-opacity='1'/%3E%3Ccircle cx='16' cy='64' r='14.344' fill='%23000000' fill-opacity='1' transform='rotate(45 64 64)'/%3E%3Ccircle cx='16' cy='64' r='12.531' fill='%23000000' fill-opacity='1' transform='rotate(90 64 64)'/%3E%3Ccircle cx='16' cy='64' r='10.75' fill='%23000000' fill-opacity='1' transform='rotate(135 64 64)'/%3E%3Ccircle cx='16' cy='64' r='10.063' fill='%23000000' fill-opacity='1' transform='rotate(180 64 64)'/%3E%3Ccircle cx='16' cy='64' r='8.063' fill='%23000000' fill-opacity='1' transform='rotate(225 64 64)'/%3E%3Ccircle cx='16' cy='64' r='6.438' fill='%23000000' fill-opacity='1' transform='rotate(270 64 64)'/%3E%3Ccircle cx='16' cy='64' r='5.375' fill='%23000000' fill-opacity='1' transform='rotate(315 64 64)'/%3E%3CanimateTransform attributeName='transform' type='rotate' values='0 64 64;315 64 64;270 64 64;225 64 64;180 64 64;135 64 64;90 64 64;45 64 64' calcMode='discrete' dur='720ms' repeatCount='indefinite'%3E%3C/animateTransform%3E%3C/g%3E%3C/svg%3E";
        const webcamLoadingIconLight = "data:image/svg+xml,%3C%3Fxml version='1.0' encoding='UTF-8' standalone='no'%3F%3E%3Csvg xmlns:svg='http://www.w3.org/2000/svg' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' version='1.0' width='128px' height='128px' viewBox='-256 -256 640 640' xml:space='preserve'%3E%3Cg%3E%3Ccircle cx='16' cy='64' r='16' fill='%23ffffff' fill-opacity='1'/%3E%3Ccircle cx='16' cy='64' r='14.344' fill='%23ffffff' fill-opacity='1' transform='rotate(45 64 64)'/%3E%3Ccircle cx='16' cy='64' r='12.531' fill='%23ffffff' fill-opacity='1' transform='rotate(90 64 64)'/%3E%3Ccircle cx='16' cy='64' r='10.75' fill='%23ffffff' fill-opacity='1' transform='rotate(135 64 64)'/%3E%3Ccircle cx='16' cy='64' r='10.063' fill='%23ffffff' fill-opacity='1' transform='rotate(180 64 64)'/%3E%3Ccircle cx='16' cy='64' r='8.063' fill='%23ffffff' fill-opacity='1' transform='rotate(225 64 64)'/%3E%3Ccircle cx='16' cy='64' r='6.438' fill='%23ffffff' fill-opacity='1' transform='rotate(270 64 64)'/%3E%3Ccircle cx='16' cy='64' r='5.375' fill='%23ffffff' fill-opacity='1' transform='rotate(315 64 64)'/%3E%3CanimateTransform attributeName='transform' type='rotate' values='0 64 64;315 64 64;270 64 64;225 64 64;180 64 64;135 64 64;90 64 64;45 64 64' calcMode='discrete' dur='720ms' repeatCount='indefinite'%3E%3C/animateTransform%3E%3C/g%3E%3C/svg%3E";
        self._switchWebcam = function (cameraNum) {
            if (self.bindingDone && self.webcam_perm() && self.widget.webcam.shown() && cameraNum != 0) {
                // Only change webcam stuff if the camera has changed or the webcam has been unloaded
                if (cameraNum != self.webcamState() || !(self.webcamHlsEnabled() || self.webcamMjpgEnabled())) {
                    self.webcamMjpgEnabled(true);
                    self.webcamHlsEnabled(false);
                    $('#dashboard_webcam_mjpg').attr('src', (document.fullscreenElement || dashboardIsFull) && !self.dashboardSettings.fullscreenUseThemeColors() ? webcamLoadingIconLight : webcamLoadingIcon);
                    setTimeout(() => {
                        if (self.dashboardSettings.enableDashMultiCam()) {
                            var webcamIndex = cameraNum - 1;
                            var webcam = self.dashboardSettings._webcamArray()[webcamIndex];

                            var url = webcam.url();
                            var nonce_separator = url.includes('?') ? '&' : '?';
                            var nonce = webcam.disableNonce() ? '' : nonce_separator + 'nonce_dashboard=' + new Date().getTime();

                            self.rotate(webcam.rotate());
                            self.flipH(webcam.flipH());
                            self.flipV(webcam.flipV());
                        } else {
                            self.rotate(self.settingsViewModel.settings.webcam.rotate90());
                            self.flipH(self.settingsViewModel.settings.webcam.flipH());
                            self.flipV(self.settingsViewModel.settings.webcam.flipV());

                            var url = self.settingsViewModel.settings.webcam.streamUrl();
                            var nonce_separator = url.includes('?') ? '&' : '?';
                            var nonce = self.dashboardSettings.disableWebcamNonce() ? '' : nonce_separator + 'nonce_dashboard=' + new Date().getTime();
                        }

                        let streamType = "mjpg";
                        if (self.hls_capable()) {
                            streamType = determineWebcamStreamType(url);
                        }

                        if (streamType === "mjpg") {
                            self._switchToMjpgWebcam(url, nonce);
                        } else if (streamType == "hls") {
                            self._switchToHlsWebcam(url);
                        } else {
                            throw "Unknown stream type " + streamType;
                        }

                        self.webcamState(cameraNum);
                    }, 100);
                }
            } else {
                self.webcamState(cameraNum);
                self._disableWebcam();
            }
        };

        self.switchWebcam = function () {
            self._switchWebcam(this);
        };

        self.dashboardFullClass = function () {
            var css = { dashboardOverlayFull: self.dashboardSettings.dashboardOverlayFull() };
            css['dashboard_full_ratio169_rotated'] = false;
            css['dashboard_full_ratio43_rotated'] = false;
            css['dashboard_full_ratio169_unrotated'] = false;
            css['dashboard_full_ratio43_unrotated'] = false;
            css['dashboard_full_' + self.webcamRatioClass() + (self.rotate() ? '_rotated' : '_unrotated')] = true;
            return css;
        };

        self.webcamRatioClass = function () {
            if (self.dashboardSettings.enableDashMultiCam()) {
                var webcamIndex = self.webcamState() - 1;
                var webcam = self.dashboardSettings._webcamArray()[webcamIndex];
                if (webcam == null) {
                    return 'ratio169';
                }
                return webcam.streamRatio() == '16:9' ? 'ratio169' : 'ratio43';
            } else {
                return self.settingsViewModel.settings.webcam.streamRatio() == '16:9' ? 'ratio169' : 'ratio43';
            }
        };

        // --- Time Display Code ---

        self.formatSeconds = function (seconds) {
            var minutes = Math.floor(seconds / 60);
            seconds %= 60;
            seconds = String(seconds).padStart(2, '0');
            var hours = Math.floor(minutes / 60);
            minutes %= 60;
            minutes = String(minutes).padStart(2, '0');
            if (hours != 0)
                return `${hours}:${minutes}:${seconds}`;
            return `${minutes}:${seconds}`;
        }

        var formatTime = (date) => {
            var str = "";
            var ampm = "";
            var hours = date.getHours();
            var minutes = date.getMinutes();
            var seconds = date.getSeconds();
            minutes = minutes < 10 ? '0' + minutes : minutes;
            seconds = seconds < 10 ? '0' + seconds : seconds;
            if (self.dashboardSettings.ETAUse12HTime()) {
                ampm = hours >= 12 ? ' pm' : ' am';
                hours = hours % 12;
                hours = hours ? hours : 12;
            }
            if (self.dashboardSettings.ETAShowSeconds()) {
                str = hours + ':' + minutes + ':' + seconds + ampm;
            } else {
                str = hours + ':' + minutes + ampm;
            }
            return str;
        }

        self.getEta = function (seconds) {
            var dt = new Date();
            var today = dt.toString().split(' ').slice(1, 4).join(' ');
            dt.setSeconds(dt.getSeconds() + seconds);
            var dtDay = dt.toString().split(' ').slice(1, 4).join(' ');
            var eta = formatTime(dt);
            if (self.settingsViewModel.settings.plugins.dashboard.ETAShowDate() && today != dtDay) {
                eta += ' ' + dtDay.split(' ').slice(0, 2).join(' ');
            }
            return eta;
        };

        // --- 3/4 Gague Tick code ---
        self.tempGaugeSvgPath = ko.computed(() => {
            a = Math.PI / 180 * (360 - self.tempGaugeAngle()) / 2;
            offset = self.tempGaugeOffset();
            radius = self.tempGaugeRadius();
            leftX = (radius - radius * Math.sin(a) + offset).toFixed(2);
            leftY = (offset + radius + radius * Math.cos(a)).toFixed(2);
            rightX = (2 * radius * Math.sin(a)).toFixed(2);
            rightY = 0;

            return `M${leftX} ${leftY}a${radius} ${radius} 0 1 1 ${rightX} ${rightY}`;
        });

        self.tempGaugePathLen = ko.computed(() => {
            return (self.tempGaugeRadius() * Math.PI * self.tempGaugeAngle() / 180).toFixed(2);
        });

        self.tempGaugeViewBox = ko.computed(() => {
            return `0 0 ${2 * (self.tempGaugeRadius() + self.tempGaugeOffset())} ${2 * (self.tempGaugeRadius() + self.tempGaugeOffset())}`;
        });

        self.tempGaugeTickPath = (tick) => {
            a = Math.PI / 180 * (0.5 * (360 - self.tempGaugeAngle()) + self.tempGaugeAngle() * tick);
            offset = self.tempGaugeOffset();
            radius = self.tempGaugeRadius();
            inset = 10;
            outset = 20;

            innerX = (radius - (radius - inset) * Math.sin(a) + offset).toFixed(2);
            innerY = (offset + radius + (radius - inset) * Math.cos(a)).toFixed(2);
            outerX = (-(inset + outset) * Math.sin(a)).toFixed(2);
            outerY = ((inset + outset) * Math.cos(a)).toFixed(2);

            return `M${innerX} ${innerY}l${outerX} ${outerY}`;
        };

        self.tempGaugeTickTextX = (tick) => {
            a = Math.PI / 180 * (0.5 * (360 - self.tempGaugeAngle()) + self.tempGaugeAngle() * tick);
            offset = self.tempGaugeOffset();
            radius = self.tempGaugeRadius();
            textOutset = 35;

            textX = (radius - (radius + textOutset) * Math.sin(a) + offset).toFixed(2);

            return textX;
        };

        self.tempGaugeTickTextY = (tick) => {
            a = Math.PI / 180 * (0.5 * (360 - self.tempGaugeAngle()) + self.tempGaugeAngle() * tick);
            offset = self.tempGaugeOffset();
            radius = self.tempGaugeRadius();
            textOutset = 35;

            textY = (offset + radius + (radius + textOutset) * Math.cos(a)).toFixed(2);

            return textY;
        };

        self.formatFanText = function (fanSpeed) {
            if (isNaN(fanSpeed))
                return "Off";
            if (fanSpeed == 0)
                return "Off";
            return Number.parseFloat(fanSpeed).toFixed(0) + "%";
        }

        self.formatFanOffset = function (fanSpeed) {
            if (fanSpeed && !isNaN(fanSpeed)) {
                return (self.tempGaugePathLen() * (1 - fanSpeed / 100)).toFixed(2);
            } else return (self.tempGaugePathLen() * 0.01);
        };

        self.formatProgressOffset = function (currentProgress) {
            // if (currentProgress && !isNaN(currentProgress)) {
            if (currentProgress) {
                return 339.292 * (1 - (currentProgress / 100));
            } else return 339.292;
        };

        self.formatTempOffset = function (temp, range) {
            if (temp) {
                return (self.tempGaugePathLen() * (1 - Math.min(temp, range) / range)).toFixed(2);
            } else return self.tempGaugePathLen();
        };

        self.formatConnectionstatus = function (currentStatus) {
            if (currentStatus) {
                return gettext("Connected");
            } else return gettext("Disconnected");
        };

        self.formatPercentage = function (percentage) {
            if (isNaN(percentage)) {
                return "-";
            }
            return percentage.toFixed(0) + '%';
        };

        self.celsiusToFahrenheit = function (c) {
            return (9 / 5 * c) + 32;
        };

        self.fahrenheitToCelsius = function (f) {
            return (f - 32) * 5 / 9;
        };

        self.convertTemp = function (x) {
            if (self.dashboardSettings.useFahrenheit()) {
                return self.celsiusToFahrenheit(x);
            } else {
                return x;
            }
        };

        self.convertTempInverse = function (x) {
            if (self.dashboardSettings.useFahrenheit()) {
                return self.fahrenheitToCelsius(x);
            } else {
                return x;
            }
        };

        self.tempSymbol = function () {
            if (self.dashboardSettings.useFahrenheit()) {
                return '°F';
            } else {
                return '°C';
            }
        };

        // --- CMD Widget Code ---
        self.testCommandWidget = function () {
            $.ajax({
                url: API_BASEURL + "plugin/dashboard",
                type: "POST",
                dataType: "json",
                data: JSON.stringify({
                    command: "testCmdWidget",
                    cmd: this
                }),
                contentType: "application/json; charset=UTF-8"
            });
        };

        self.addCommandWidget = function () {
            console.log("Adding command Widget");
            self.dashboardSettings.commandWidgetArray.push({ icon: ko.observable('command-icon.png'), name: ko.observable(''), command: ko.observable(''), enabled: ko.observable(false), interval: ko.observable(10), type: ko.observable("text") });
        };

        self.removeCommandWidget = function (command) {
            console.log("Removing Command Widget");
            self.dashboardSettings.commandWidgetArray.remove(command);
        };

        // --- MultiCam Array Code ---
        self.addWebCam = function () {
            console.log("Adding Webcam");
            self.dashboardSettings._webcamArray.push({ name: ko.observable('name'), url: ko.observable('http://'), flipV: ko.observable(false), flipH: ko.observable(false), rotate: ko.observable(false), disableNonce: ko.observable(false), streamRatio: ko.observable('16:9') });
            self.switchToDefaultWebcam();
        };

        self.removeWebCam = function (webCam) {
            console.log("Removing Webcam");
            self.dashboardSettings._webcamArray.remove(webCam);
            self.switchToDefaultWebcam();
        };


        self.onTabChange = function (current, previous) {

            self.currentTab = current;

            if (current == "#tab_plugin_dashboard") {
                self._switchWebcam(self.webcamState());
                self.updateChartWidth();
            } else if (previous == "#tab_plugin_dashboard") {
                self._disableWebcam();
            };
        };


        self.renderChart = function (layerTimes, layerLabels) {
            if (self.bindingDone) {
                //create a prototype multi-dimensional array
                var data = {
                    labels: [],
                    series: [
                        []
                    ]
                };

                //Prep the data
                var values = JSON.parse(layerTimes);
                var labels = JSON.parse(layerLabels);

                if (self.dashboardSettings.layerGraphType() == "last40layers") {
                    for (var i = values.length - 40; i < values.length; i += 1) {
                        data.series[0].push(values[i])
                    }
                    for (var i = labels.length - 40; i < labels.length; i += 1) {
                        data.labels.push(labels[i])
                    }
                } else {
                    for (var i = 0; i < values.length; i += 1) {
                        data.series[0].push(values[i])
                    }
                    for (var i = 0; i < labels.length; i += 1) {
                        data.labels.push(labels[i])
                    }
                }

                let calculatedWidth = 98;

                if (self.dashboardSettings.layerGraphType() == "scrolling") {
                    calculatedWidth *= Math.max(labels.length / 40, 1)
                }

                self.chartWidth = calculatedWidth;

                //Chart Options
                var options = {
                    onlyInteger: true,
                    showPoint: false,
                    lineSmooth: true,
                    fullWidth: true,
                    width: `${calculatedWidth}%`,
                    height: '150px',
                    axisX: {
                        showGrid: false,
                        showLabel: true,
                        labelInterpolationFnc: function skipLabels(value, index, labels) {
                            let interval = (self.dashboardSettings.layerGraphType() == "normal")
                                ? Math.ceil(labels.length / 20)
                                : 5;

                            if (labels[index] % interval == 0) {
                                return value;
                            } else {
                                return null;
                            }
                        }
                    }
                };
                self.layerGraph.update(data, options);
            }
        };

        self.updateChartWidth = function () {
            if (self.bindingDone) {
                var options = {
                    width: `${self.chartWidth}%`
                };
                self.layerGraph.update(options);
            }
        };

        self.gaugesCentreInGrid = function (type, index = 0, css = {}) {
            var last = [{}];
            var totalNum = 0;
            var setLast = function (type, index = 0) {
                totalNum++;
                last[1] = last[0];
                last[0] = { type: type, index: index };
            }
            if (self.temperatureModel.isOperational()) {
                if (self.dashboardSettings.enableTempGauges()) {
                    self.temperatureModel.tools().forEach(function (val, index) {
                        if (!self.dashboardSettings.hideHotend() || (self.dashboardSettings.hideHotend() && val.target() > 0))
                            setLast('tool', index);
                    });
                    if (self.temperatureModel.hasBed())
                        setLast('bed');
                    if (self.temperatureModel.hasChamber())
                        setLast('chamber');
                }
                if (self.dashboardSettings.showFan())
                    setLast('fan');

                if (self.dashboardSettings.showSensorInfo() && self.enclosureViewModel && self.dashboardSettings.enclosureGaugeStyle() == "3/4") {
                    self.enclosureViewModel.rpi_inputs_temperature_sensors().forEach(function (val, index) {
                        setLast('enclosure', index);
                    });
                }

                if (self.dashboardSettings.showCommandWidgets()) {
                    self.commandWidgetArray().forEach(function (val, index) {
                        if (val.enabled() && self.castToWidgetTypes(val.type()) === self.widgetTypes.THREE_QUARTER)
                            setLast('cmd', index);
                    });
                }

                totalNum %= 3;

                css.centreInGrid2 = false;
                css.centreInGrid1 = false;
                // Check that this gauge is one of the two in the final row
                if (totalNum == 2 && ((type == last[0].type && index == last[0].index) || (type == last[1].type && index == last[1].index)))
                    css.centreInGrid2 = true;
                // Check that this gauge is the one in the final row
                if (totalNum == 1 && type == last[0].type && index == last[0].index)
                    css.centreInGrid1 = true;
            }
            return css;
        }

        // full page
        if (dashboardIsFull) {
            var dashboardFullLoaderHtml = '<div class="dashboardFullLoader">Please Wait...</div>';
            $('body').append(dashboardFullLoaderHtml);
        }

        // startup complete
        self.onStartupComplete = function () {
            try {
                self.admin(self.loginState.userneeds().role.includes('plugin_dashboard_admin'));
            }
            catch {
                self.admin(true);
            }

            try {
                self.webcam_perm(self.loginState.userneeds().role.includes('webcam'));
            }
            catch {
                self.webcam_perm(true);
            }


            OctoPrint.get("api/version")
                .done(function (response) {
                    verParts = response.server.split('.');
                    if (Number(verParts[0]) >= 1 && Number(verParts[1]) >= 5) {
                        self.hls_capable(true);
                    }
                });

            if (self.webcam_perm) {
                self.switchToDefaultWebcam();
            }

            self.layerGraph = new Chartist.Line('.ct-chart');

            self.doTempGaugeTicks();

            // full page
            if (dashboardIsFull) {
                self.isFull(true);
                $('#dashboardContainer').addClass('dashboard-full');
                $('body').css('overflow', 'hidden');
                $('.dashboardFullLoader').css('display', 'none');
                if (self.dashboardSettings.fullscreenUseThemeColors()) {
                    document.getElementById('dashboardContainer').style.setProperty('color', 'inherit', 'important');
                    $('#dashboardContainer').css('background-color', 'inherit');
                    $('#dashboardContainer').parents(':not(html):not(body)').css('background-color', 'inherit');
                }
            }

            self.RefreshThemeColors();

            try {
                self.settingsViewModel.settings.plugins.themeify.theme.subscribe(function (newValue) {
                    self.RefreshThemeColors();
                });
                self.settingsViewModel.settings.plugins.themeify.enabled.subscribe(function (newValue) {
                    self.RefreshThemeColors();
                });
            } catch { }

            try {
                self.settingsViewModel.settings.plugins.uicustomizer.theme.subscribe(function (newValue) {
                    self.RefreshThemeColors();
                });
            } catch { }

            self.dashboardSettings.useThemeifyColor.subscribe(function (newValue) {
                self.RefreshThemeColors();
            });

            self.settingsViewModel.settings.webcam.rotate90.subscribe(function (newValue) {
                self.rotate(newValue);
            });
            self.settingsViewModel.settings.webcam.flipH.subscribe(function (newValue) {
                self.flipH(newValue);
            });
            self.settingsViewModel.settings.webcam.flipV.subscribe(function (newValue) {
                self.flipV(newValue);
            });

            self.printerStateModel.printTime.subscribe(function (newValue) {
                if (newValue == null || self.printerStateModel.printTimeLeft() == null || self.printerStateModel.printTimeLeft() == 0) {
                    self.timeProgressString(0.01);
                    self.timeProgressBarString("0%");
                } else {
                    self.timeProgressString((newValue / (newValue + self.printerStateModel.printTimeLeft())) * 100);
                    self.timeProgressBarString(Math.round((newValue / (newValue + self.printerStateModel.printTimeLeft())) * 100) + "%");
                }
            });

            document.addEventListener("visibilitychange", () => {
                if (document.visibilityState == 'visible' && self.currentTab == '#tab_plugin_dashboard') {
                    self._switchWebcam(self.webcamState());
                } else {
                    self._disableWebcam();
                }
            });

            if (self.dashboardSettings.showPrintThumbnail()) {
                setTimeout(self.updatePrintThumbnail, 2500);
            }

            self.printerStateModel.isPrinting.subscribe(function () {
                self.fitties.forEach(f => f.fit());
            });
        }

        self.onServerDisconnect = function () {
            self._disableWebcam();
        }

        self.onDataUpdaterReconnect = function () {
            if (self.currentTab == '#tab_plugin_dashboard') {
                self._switchWebcam(self.webcamState());
            } else {
                self._disableWebcam();
            }
        }

        var jobCanceling = false;
        var jobCancelI = null;
        var jobCancelOldText = '';
        self.jobCancel = function () {
            if (jobCanceling) {
                $('button.dashboardButton#job_cancel > span').html(jobCancelOldText);
                $('button.dashboardButton#job_cancel').removeClass('confirm');
                clearInterval(jobCancelI);
                jobCancelI = null;
                OctoPrint.job.cancel();
                jobCanceling = false;
            } else if (!self.printerStateModel.settings.feature_printCancelConfirmation()) {
                OctoPrint.job.cancel();
            } else {
                jobCanceling = true;
                jobCancelOldText = $('button.dashboardButton#job_cancel > span').html();
                $('button.dashboardButton#job_cancel').addClass('confirm');
                var t = 5;
                var setText = function () {
                    $('button.dashboardButton#job_cancel > span').html(gettext('Click again to confirm cancel') + ' <span>(' + t-- + ')</span>');
                }
                setTimeout(() => {
                    if (jobCanceling)
                        setText();
                }, 500);
                jobCancelI = setInterval(function () {
                    if (t < 0) {
                        $('button.dashboardButton#job_cancel > span').html(jobCancelOldText);
                        $('button.dashboardButton#job_cancel').removeClass('confirm');
                        clearInterval(jobCancelI);
                        jobCanceling = false;
                        jobCancelI = null;
                    } else
                        setText();
                }, 1000);
            }
        }
    };

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push({
        construct: DashboardViewModel,
        dependencies: ["temperatureViewModel", "printerStateViewModel", "printerProfilesViewModel", "connectionViewModel", "settingsViewModel", "controlViewModel", "enclosureViewModel", "loginStateViewModel"],
        optional: ["enclosureViewModel"],
        elements: ["#tab_plugin_dashboard", "#settings_plugin_dashboard"]
    });
});
