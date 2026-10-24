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
        self.access = parameters[8];

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

        // Temperature gauge ticks, as fractions of the scale
        self.tempGaugeTicks = ko.observableArray([0.0, 0.25, 0.5, 0.75, 1.0]);

        self.admin = ko.observableArray(false);
        self.webcam_perm = ko.observable(false);
        self.hls_capable = ko.observable(false);


        // Widget registry, filled in onBeforeBinding: self.widgets is the ordered list, self.widget looks one up by id
        self.widgets = [];
        self.widget = {};


        self.hls;


        //Fullscreen
        self.urlParams = new URLSearchParams(window.location.search);
        var dashboardIsFull = self.urlParams.has('dashboard') && (self.urlParams.get('dashboard') == 'full');

        self.bindingDone = false;

        // Layer durations in seconds and their layer numbers, for the layer graph
        self.layerTimes = ko.observableArray([]);
        self.layerTimeLabels = ko.observableArray([]);

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
                if (data.currentFeedrate && self.isPlaced("feedrate")) {
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

            if (self.isPlaced("printThumbnail")) {
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
            if (self.dashboardSettings.clearOn_PrintThumbnail() == 2) {
                $("#dashboard_print_thumbnail").remove();
                self.hasPrintThumbnail(false);
            }
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
            // One entry per widget, in the order they appear in settings. size is the size a widget gets when it
            // is added to a layout; entries without one are settings rather than widgets (setting names the
            // plugin setting that turns them on and off). Which widgets are shown, where, how big and whether
            // only while printing is stored in the layouts, see layout.py.
            // A widget's own settings are shown in its settings dialog, in one of two ways (ONLY ONE PER WIDGET):
            //   a template with the id dashboard_settings_<id> in the settings page jinja template
            //   settings: an array of radio, checkbox or title settings, see Progress Gauges and Filament Widget
            // clearOn names the setting for when its data is cleared (1 = print start, 2 = print end).
            var definitions = [
                { id: "fullscreenButtons", title: gettext("FullScreen & FullBrowser Mode Buttons"), setting: "showFullscreen" },
                { id: "systemInfo", title: gettext("System Info"), size: "4x1" },
                { id: "status", title: gettext("Status"), size: "4x1" },
                { id: "jobControlButtons", title: gettext("Job Control Buttons"), size: "4x1" },
                { id: "tempGauges", title: gettext("Temperature Gauges"), size: "3x1" },
                { id: "fan", title: gettext("Fan Gauge"), size: "1x1" },
                {
                    id: "sensorInfo",
                    title: gettext("Enclosure Gauges"),
                    size: "4x1",
                    settings: [
                        { type: "radio", title: gettext("Enclosure Plugin Gague Style"), setting: dashboardSettings.enclosureGaugeStyle, options: [{ name: gettext("Temperature Dial"), value: "3/4" }, { name: gettext("Text"), value: "text" }] }
                    ]
                },
                { id: "printThumbnail", title: gettext("Print Thumbnail (Slicer Thumbnails)"), size: "2x1", clearOn: "clearOn_PrintThumbnail" },
                { id: "commandWidgets", title: gettext("Command Widgets"), size: "4x1" },
                { id: "printerMessage", title: gettext("Printer Message (M117)"), size: "4x1", clearOn: "clearOn_PrinterMessage" },
                {
                    id: "progressGauges",
                    title: gettext("Progress Gauges"),
                    size: "4x1",
                    // an added progress widget needs at least one gauge
                    onAdd: function () {
                        if (!(dashboardSettings.showTimeProgress() || dashboardSettings.showProgress() || dashboardSettings.showLayerProgress() || dashboardSettings.showHeightProgress())) {
                            dashboardSettings.showTimeProgress(true);
                            dashboardSettings.showProgress(true);
                        }
                    },
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
                    size: "4x1",
                    clearOn: "clearOn_LayerGraph",
                    settings: [
                        { type: "radio", title: gettext("Layer graph type"), setting: dashboardSettings.layerGraphType, options: [{ name: gettext("Normal"), value: "normal" }, { name: gettext("Last 40 Layers"), value: "last40layers" }, { name: gettext("Scrolling"), value: "scrolling" }] }
                    ]
                },
                { id: "fileName", title: gettext("File Name"), size: "4x1" },
                {
                    id: "filament",
                    title: gettext("Filament Widget"),
                    size: "2x1",
                    clearOn: "clearOn_Filament",
                    settings: [
                        { type: "title", title: gettext("The filament widget shows how much filament has been extruded. It can also show the time untill next filament change.") },
                        { type: "checkbox", title: gettext("Show time untill next filament change"), setting: dashboardSettings.showFilamentChangeTime }
                    ]
                },
                { id: "feedrate", title: gettext("Feedrate"), size: "2x1", clearOn: "clearOn_Feedrate" },
                { id: "timeEstimate", title: gettext("Time Estimate"), size: "4x1" },
                { id: "layerInfo", title: gettext("Layer Info"), size: "4x1" },
                { id: "webcam", title: gettext("Webcam"), size: "2x2" }
            ];

            self.widgets = definitions.map(self.createWidget);
            self.widgets.forEach(function (widget) {
                self.widget[widget.id] = widget;
            });
            self.placeableWidgets = self.widgets.filter(function (widget) {
                return widget.size;
            });
        };

        // --- Layouts ---
        // dashboardSettings.layout.tab and .full are observable arrays of placements { id, size, printingOnly }.
        // The tab shows the tab layout, fullscreen and the full browser window show the full layout, and while
        // editing the layout being edited is shown.
        self.layoutSizes = ["1x1", "2x1", "3x1", "4x1", "2x2", "4x2"];
        self.editMode = ko.observable(false);
        self.editLayoutName = ko.observable("tab");
        self.draggedPlacement = ko.observable(null);

        self.layoutOf = function (name) {
            var layout = self.dashboardSettings && self.dashboardSettings.layout;
            return layout && layout[name] ? layout[name] : ko.observableArray([]);
        };

        self.activeLayoutName = ko.pureComputed(function () {
            if (self.editMode())
                return self.editLayoutName();
            return self.isFull() ? "full" : "tab";
        });

        self.activeLayout = ko.pureComputed(function () {
            return self.layoutOf(self.activeLayoutName())();
        });

        self.makePlacement = function (id, size, printingOnly) {
            return { id: ko.observable(id), size: ko.observable(size), printingOnly: ko.observable(!!printingOnly) };
        };

        self.findPlacement = function (name, id) {
            return ko.utils.arrayFirst(self.layoutOf(name)(), function (placement) {
                return placement.id() == id;
            });
        };

        // Widgets that have nothing to show at the moment, their cards are hidden rather than left empty
        self.hasPrintThumbnail = ko.observable(false);
        self.widgetEmpty = {
            printThumbnail: function () { return !self.hasPrintThumbnail(); },
            tempGauges: function () { return !self.temperatureModel.isOperational(); },
            fan: function () { return !self.temperatureModel.isOperational(); },
            sensorInfo: function () { return !self.enclosureViewModel || self.enclosureViewModel.rpi_inputs_temperature_sensors().length == 0; },
            commandWidgets: function () { return !self.commandWidgetArray().some(function (command) { return command.enabled(); }); },
            webcam: function () { return !self.webcam_perm(); }
        };

        // A placement is shown unless it is limited to printing and nothing prints, or it has nothing to show.
        // While editing everything is shown.
        self.placementShown = function (placement) {
            if (self.editMode())
                return true;
            var empty = self.widgetEmpty[placement.id()];
            return (!placement.printingOnly() || self.printerStateModel.isPrinting()) && !(empty && empty());
        };

        self.placementTitle = function (placement) {
            var widget = self.widget[placement.id()];
            return widget ? widget.title : placement.id();
        };

        self.placeWidget = function (name, widget, printingOnly) {
            if (self.findPlacement(name, widget.id))
                return;
            if (widget.onAdd)
                widget.onAdd();
            self.layoutOf(name).push(self.makePlacement(widget.id, widget.size, printingOnly));
        };

        // Placed in the tab or the full layout
        self.isPlaced = function (id) {
            return !!(self.findPlacement("tab", id) || self.findPlacement("full", id));
        };

        self.unplaceWidget = function (name, id) {
            var placement = self.findPlacement(name, id);
            if (placement)
                self.layoutOf(name).remove(placement);
        };

        // Turns a registry definition into a widget. enabled, enableInFull and printingOnly read and write the layouts:
        //   enabled: placed in the tab (turning it off also takes it out of fullscreen)
        //   enableInFull: placed in fullscreen
        //   printingOnly: only shown while printing, in both layouts
        // The tab uses the computed observables, which follow the layout being shown:
        //   inLayout: placed in it
        //   printingOk: not limited to printing, or a print is running
        //   shown: both of the above
        self.createWidget = function (definition) {
            var dashboardSettings = self.dashboardSettings;
            var widget = { id: definition.id, title: definition.title, size: definition.size, onAdd: definition.onAdd };

            if (definition.clearOn)
                widget.clearOn = dashboardSettings[definition.clearOn];
            if (definition.settings)
                widget.settings = definition.settings;

            if (!definition.size) {
                widget.enabled = dashboardSettings[definition.setting];
                widget.inLayout = widget.shown = widget.enabled;
                widget.printingOk = ko.pureComputed(function () { return true; });
                return widget;
            }

            widget.enabled = ko.pureComputed({
                read: function () {
                    return !!self.findPlacement("tab", widget.id);
                },
                write: function (value) {
                    if (value) {
                        var full = self.findPlacement("full", widget.id);
                        self.placeWidget("tab", widget, full && full.printingOnly());
                    } else {
                        self.unplaceWidget("tab", widget.id);
                        self.unplaceWidget("full", widget.id);
                    }
                }
            });
            widget.enableInFull = ko.pureComputed({
                read: function () {
                    return !!self.findPlacement("full", widget.id);
                },
                write: function (value) {
                    if (value) {
                        var tab = self.findPlacement("tab", widget.id);
                        self.placeWidget("full", widget, tab && tab.printingOnly());
                    } else {
                        self.unplaceWidget("full", widget.id);
                    }
                }
            });
            widget.printingOnly = ko.pureComputed({
                read: function () {
                    var placement = self.findPlacement("tab", widget.id) || self.findPlacement("full", widget.id);
                    return placement ? placement.printingOnly() : false;
                },
                write: function (value) {
                    ["tab", "full"].forEach(function (name) {
                        var placement = self.findPlacement(name, widget.id);
                        if (placement)
                            placement.printingOnly(value);
                    });
                }
            });

            widget.inLayout = ko.pureComputed(function () {
                return !!self.findPlacement(self.activeLayoutName(), widget.id);
            });
            widget.printingOk = ko.pureComputed(function () {
                var placement = self.findPlacement(self.activeLayoutName(), widget.id);
                return !placement || !placement.printingOnly() || self.printerStateModel.isPrinting();
            });
            widget.shown = ko.pureComputed(function () {
                return widget.inLayout() && widget.printingOk();
            });
            return widget;
        };

        self.enableWidget = function (widget) {
            widget.enabled(true);
        };

        self.disableWidget = function (widget) {
            widget.enabled(false);
        };

        // --- Layout editing ---
        var layoutBeforeEdit = null;

        self.canEditLayout = ko.pureComputed(function () {
            try {
                return self.loginState.hasPermission(self.access.permissions.SETTINGS);
            } catch (e) {
                return self.loginState.isAdmin();
            }
        });

        self.layoutToJS = function () {
            var plain = {};
            ["tab", "full"].forEach(function (name) {
                plain[name] = self.layoutOf(name)().map(function (placement) {
                    return { id: placement.id(), size: placement.size(), printingOnly: !!placement.printingOnly() };
                });
            });
            return plain;
        };

        self.setLayout = function (name, placements) {
            self.layoutOf(name)(placements.map(function (placement) {
                return self.makePlacement(placement.id, placement.size, placement.printingOnly);
            }));
        };

        self.startEditLayout = function () {
            layoutBeforeEdit = self.layoutToJS();
            self.editLayoutName(self.isFull() ? "full" : "tab");
            self.editMode(true);
        };

        // Cancel also undoes changes made in widget settings dialogs, by reloading the settings
        self.cancelEditLayout = function () {
            if (layoutBeforeEdit) {
                self.setLayout("tab", layoutBeforeEdit.tab);
                self.setLayout("full", layoutBeforeEdit.full);
            }
            self.editMode(false);
            self.settingsViewModel.requestData();
        };

        // Done saves the layouts and the dashboard settings changed in widget settings dialogs
        self.finishEditLayout = function () {
            var data = ko.mapping.toJS(self.dashboardSettings);
            data.layout = self.layoutToJS();
            OctoPrint.settings.savePluginSettings("dashboard", data)
                .done(function () {
                    self.editMode(false);
                })
                .fail(function () {
                    new PNotify({
                        title: "Dashboard",
                        type: "error",
                        text: gettext("The layout could not be saved."),
                        hide: true
                    });
                });
        };

        self.resetLayout = function () {
            OctoPrint.get("api/plugin/dashboard").done(function (response) {
                self.setLayout(self.editLayoutName(), response.defaultLayout[self.editLayoutName()]);
            });
        };

        self.unplacedWidgets = ko.pureComputed(function () {
            var name = self.editLayoutName();
            return self.placeableWidgets.filter(function (widget) {
                return !self.findPlacement(name, widget.id);
            });
        });

        self.addToEditLayout = function (widget) {
            self.placeWidget(self.editLayoutName(), widget, false);
        };

        self.removeFromEditLayout = function (placement) {
            self.layoutOf(self.editLayoutName()).remove(placement);
        };

        self.movePlacement = function (placement, offset) {
            var list = self.layoutOf(self.editLayoutName());
            var from = list.indexOf(placement);
            var to = from + offset;
            if (from < 0 || to < 0 || to >= list().length)
                return;
            list.splice(from, 1);
            list.splice(to, 0, placement);
        };

        // Dragging works with mouse, pen and touch: the card under the pointer swaps places with the dragged one
        self.dragPlacement = function (placement, event) {
            var e = event.originalEvent || event;
            if (!self.editMode() || (e.button !== undefined && e.button !== 0))
                return true;
            e.preventDefault();
            var list = self.layoutOf(self.editLayoutName());
            self.draggedPlacement(placement);

            var onMove = function (ev) {
                var under = document.elementFromPoint(ev.clientX, ev.clientY);
                var card = under && $(under).closest(".dashboardCard")[0];
                if (!card)
                    return;
                var target = ko.dataFor(card);
                var from = list.indexOf(placement);
                var to = list.indexOf(target);
                if (from < 0 || to < 0 || from == to)
                    return;
                list.splice(from, 1);
                list.splice(to, 0, placement);
            };
            var onUp = function () {
                document.removeEventListener("pointermove", onMove);
                document.removeEventListener("pointerup", onUp);
                document.removeEventListener("pointercancel", onUp);
                self.draggedPlacement(null);
            };
            document.addEventListener("pointermove", onMove);
            document.addEventListener("pointerup", onUp);
            document.addEventListener("pointercancel", onUp);
            return false;
        };

        // Arrow keys on the drag handle move the card
        self.keyMovePlacement = function (placement, event) {
            var offset = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
            if (!offset)
                return true;
            self.movePlacement(placement, offset);
            setTimeout(function () {
                $('.dashboardCard[data-id="' + placement.id() + '"] .dashboardCardHandle').focus();
            }, 0);
            return false;
        };

        // --- Widget settings dialog ---
        self.dialogWidget = ko.observable(null);

        // The dialog's placement rows, one per layout
        self.dialogPlacements = ["tab", "full"].map(function (name) {
            var placement = function () {
                var widget = self.dialogWidget();
                return widget ? self.findPlacement(name, widget.id) : null;
            };
            return {
                label: name == "tab" ? gettext("Tab") : gettext("Fullscreen"),
                shown: ko.pureComputed({
                    read: function () {
                        return !!placement();
                    },
                    write: function (value) {
                        var widget = self.dialogWidget();
                        if (value)
                            self.placeWidget(name, widget, false);
                        else
                            self.unplaceWidget(name, widget.id);
                    }
                }),
                size: ko.pureComputed({
                    read: function () {
                        var current = placement();
                        return current ? current.size() : self.dialogWidget() && self.dialogWidget().size;
                    },
                    write: function (value) {
                        var current = placement();
                        if (current)
                            current.size(value);
                    }
                }),
                printingOnly: ko.pureComputed({
                    read: function () {
                        var current = placement();
                        return current ? current.printingOnly() : false;
                    },
                    write: function (value) {
                        var current = placement();
                        if (current)
                            current.printingOnly(value);
                    }
                })
            };
        });

        self.hasSettingsTemplate = function (widget) {
            return !!document.getElementById("dashboard_settings_" + widget.id);
        };

        // Widgets whose template can be rendered a second time in the dialog (no element ids that scripts look up)
        var previewableWidgets = ["systemInfo", "status", "jobControlButtons", "tempGauges", "fan", "sensorInfo", "commandWidgets", "printerMessage", "progressGauges", "filament", "feedrate", "timeEstimate", "layerInfo"];
        self.previewable = function (widget) {
            return previewableWidgets.indexOf(widget.id) >= 0;
        };

        self.openWidgetDialog = function (widget) {
            self.dialogWidget(widget);
            $("#dashboardWidgetDialog").modal("show");
        };

        // --- Layout actions on the settings page, saved with the settings ---
        self.customizeLayoutFromSettings = function () {
            $("#settings_dialog").modal("hide");
            $('#tabs a[href="#tab_plugin_dashboard"]').tab("show");
            self.startEditLayout();
        };

        self.exportLayout = function () {
            var blob = new Blob([JSON.stringify({ dashboardLayout: 1, layout: self.layoutToJS() }, null, 2)], { type: "application/json" });
            var link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "dashboard-layout.json";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        };

        // Accepts a file from exportLayout. Unknown widgets and sizes are left out.
        self.importLayout = function (data, event) {
            var file = event.target.files[0];
            event.target.value = "";
            if (!file)
                return;
            var reader = new FileReader();
            reader.onload = function () {
                try {
                    var layout = JSON.parse(reader.result).layout;
                    ["tab", "full"].forEach(function (name) {
                        self.setLayout(name, (layout[name] || []).filter(function (placement) {
                            return self.widget[placement.id] && self.widget[placement.id].size && self.layoutSizes.indexOf(placement.size) >= 0;
                        }));
                    });
                } catch (e) {
                    new PNotify({ title: "Dashboard", type: "error", text: gettext("This is not a Dashboard layout file."), hide: true });
                }
            };
            reader.readAsText(file);
        };

        self.resetLayouts = function () {
            OctoPrint.get("api/plugin/dashboard").done(function (response) {
                self.setLayout("tab", response.defaultLayout.tab);
                self.setLayout("full", response.defaultLayout.full);
            });
        };

        // Called when a widget's template has been rendered, also after it moved between layouts
        self.widgetRendered = function (elements) {
            var card = $(elements).filter("*").first().closest(".dashboardCard");
            switch (card.attr("data-id")) {
                case "webcam":
                    if (self.bindingDone) {
                        self._disableWebcam();
                        self._switchWebcam(self.webcamState());
                    }
                    break;
                case "printThumbnail":
                    self.updatePrintThumbnail();
                    break;
            }
        };

        self.onAfterBinding = function () {
            self.bindingDone = true;
        };

        self.updatePrintThumbnail = function () {
            $('#dashboard_print_thumbnail').remove();
            thumbnail = $('#prusaslicer_state_thumbnail');
            self.hasPrintThumbnail(thumbnail.length > 0);
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
            return { dashboardOverlayFull: self.dashboardSettings.dashboardOverlayFull(), "dashboard-editing": self.editMode() };
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

        // --- Icons ---
        // 24px line icons, drawn with the text color of the theme. Command widgets name a PNG file, mapped below.
        self.icons = {
            nozzle: "M8 3h8v6H8zM6 9h12v5H6zM10 14h4l-1 4h-2zM12 20.5v.5",
            bed: "M3 16h18v3H3zM8 5c-1.5 1.7 1.5 3.3 0 5.5M12 5c-1.5 1.7 1.5 3.3 0 5.5M16 5c-1.5 1.7 1.5 3.3 0 5.5",
            chamber: "M4 4h16v16H4zM12 8v5.5M14 15.5a2 2 0 1 1-4 0a2 2 0 1 1 4 0",
            fan: "M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 10c-.5-3.5 1-6 3.5-6s3 3.5-1.5 6M14 12.5c3 1.5 4.5 4.5 2.5 6.5s-4.5-1-4.5-5M10 12.5c-3 2-6 1.5-6.5-1s3-3.5 6.5-1.5",
            spool: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M9 12a3 3 0 1 0 6 0a3 3 0 1 0-6 0M12 3v6M12 15v6",
            layers: "M12 3l9 4.5-9 4.5-9-4.5zM3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5",
            height: "M12 20V5M8 9l4-4 4 4M5 21h14M5 3h14",
            speed: "M4.5 17a8.5 8.5 0 1 1 15 0M12 15l4.5-5M11 15a1 1 0 1 0 2 0a1 1 0 1 0-2 0",
            clock: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3.5 2",
            cpu: "M7 7h10v10H7zM10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4",
            camera: "M3 7.5h4l2-3h6l2 3h4V19H3zM9 13a3 3 0 1 0 6 0a3 3 0 1 0-6 0",
            layout: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
            fullscreen: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",
            window: "M3 5h18v14H3zM3 9h18M6 7h.01M8.5 7h.01",
            file: "M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6",
            printer: "M7 9V4h10v5M6 18H4v-7h16v7h-2M7 14h10v6H7z",
            plug: "M9 3v5M15 3v5M7 8h10v3a5 5 0 0 1-10 0zM12 16v5",
            state: "M3 12h4l3-8 4 16 3-8h4",
            thermometer: "M10 14.5V5a2 2 0 1 1 4 0v9.5a3.5 3.5 0 1 1-4 0zM12 11v6",
            message: "M4 5h16v11H9l-5 4z",
            estimate: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 8v4M12 16h.01",
            hourglass: "M7 3h10M7 21h10M8 3v3l4 6-4 6v3M16 3v3l-4 6 4 6v3",
            flag: "M5 21V4M5 4h11l-2 4 2 4H5",
            command: "M4 5h16v14H4zM7 10l3 2-3 2M12 15h5",
            light: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
            bolt: "M13 3L5 14h6l-1 7 8-11h-6z",
            memory: "M4 8h16v8H4zM8 8v8M12 8v8M16 8v8M6 16v3M18 16v3",
            disk: "M4 6h16v12H4zM4 14h16M16 16.5h.01",
            trend_up: "M12 19V5M6 11l6-6 6 6",
            trend_down: "M12 5v14M6 13l6 6 6-6",
            trend_stable: "M5 12h14"
        };

        var commandIcons = {
            "command-icon.png": "command",
            "sensor-icon.png": "thermometer",
            "ambient-sensor-icon.png": "thermometer",
            "light-icon.png": "light",
            "flash-icon.png": "bolt",
            "cpu-icon.png": "cpu",
            "ram-icon.png": "memory",
            "hdd-icon.png": "disk",
            "filament-icon.png": "spool",
            "chamber-icon.png": "chamber"
        };

        self.commandIcon = function (png) {
            return commandIcons[png] || "command";
        };

        // --- Gauges ---
        // A 270 degree arc in a 120 x 96 view box, from -135 (bottom left) to 135 degrees (bottom right)
        var gaugePolar = function (radius, angle) {
            return [60 + radius * Math.sin(angle * Math.PI / 180), 54 - radius * Math.cos(angle * Math.PI / 180)];
        };

        var gaugeArcPath = function (from, to) {
            var start = gaugePolar(46, from);
            var end = gaugePolar(46, to);
            return "M" + start[0].toFixed(2) + " " + start[1].toFixed(2) + " A46 46 0 " + (to - from > 180 ? 1 : 0) + " 1 " + end[0].toFixed(2) + " " + end[1].toFixed(2);
        };

        var gaugeFraction = function (value, max) {
            var fraction = Number(value) / Number(max);
            return isNaN(fraction) ? 0 : Math.max(0, Math.min(1, fraction));
        };

        self.gaugeTrack = gaugeArcPath(-135, 135);

        self.gaugeArc = function (value, max) {
            var fraction = gaugeFraction(value, max);
            return fraction > 0.002 ? gaugeArcPath(-135, -135 + 270 * fraction) : "";
        };

        self.gaugePoint = function (value, max) {
            var point = gaugePolar(46, -135 + 270 * gaugeFraction(value, max));
            return { x: point[0].toFixed(2), y: point[1].toFixed(2) };
        };

        self.gaugeTickPaths = ko.pureComputed(function () {
            return self.tempGaugeTicks().map(function (fraction) {
                var inner = gaugePolar(35, -135 + 270 * fraction);
                var outer = gaugePolar(39, -135 + 270 * fraction);
                return "M" + inner[0].toFixed(2) + " " + inner[1].toFixed(2) + "L" + outer[0].toFixed(2) + " " + outer[1].toFixed(2);
            });
        });

        self.clampPercent = function (value) {
            var number = Number(value);
            return isNaN(number) ? 0 : Math.max(0, Math.min(100, number));
        };

        // Fills in what a gauge leaves out: the dashboard_gauge template calls all of these
        self.makeGauge = function (gauge) {
            var none = function () { return null; };
            return $.extend({
                target: function () { return 0; },
                targetText: function () { return ""; },
                unit: function () { return ""; },
                ticks: function () { return []; },
                color: function () { return self.accentColor(); },
                history: function () { return ""; },
                trend: none
            }, gauge);
        };

        // Heating colors: below the target (minus the deviation) is heating, above it too hot, in between at target
        self.heaterColor = function (actual, target) {
            if (!self.dashboardSettings.showTempGaugeColors() || !(target > 0))
                return self.accentColor();
            var deviation = Number(self.dashboardSettings.targetTempDeviation());
            if (actual < target - deviation)
                return "#e8590c";
            if (actual > target + deviation)
                return "#e03131";
            return "#2f9e44";
        };

        // The temperature history OctoPrint keeps for its graph, as [time in ms, value] pairs
        var historySeconds = 600;
        var temperatureHistory = function (key) {
            var temperatures = self.temperatureModel.temperatures;
            return temperatures && temperatures[key] && temperatures[key].actual ? temperatures[key].actual : [];
        };

        // The last ten minutes (or less, if OctoPrint has less) as polyline points in a 180 x 22 view box,
        // scaled to the lowest and highest temperature in that time but at least 10 degrees
        self.historyPoints = function (key) {
            var history = temperatureHistory(key);
            if (history.length < 2)
                return "";
            var end = history[history.length - 1][0];
            var points = history.filter(function (point) {
                return point[0] >= end - historySeconds * 1000;
            });
            var start = points[0][0];
            var values = points.map(function (point) { return point[1]; });
            var low = Math.min.apply(null, values);
            var high = Math.max(Math.max.apply(null, values), low + 10);
            return points.map(function (point) {
                return ((point[0] - start) / Math.max(1, end - start) * 180).toFixed(1) + "," + (21 - (point[1] - low) / (high - low) * 20).toFixed(1);
            }).join(" ");
        };

        // Compares with 30 seconds ago: up, down or stable
        self.historyTrend = function (key) {
            var history = temperatureHistory(key);
            if (history.length < 2)
                return null;
            var last = history[history.length - 1];
            var earlier = ko.utils.arrayFirst(history, function (point) {
                return point[0] >= last[0] - 30000;
            });
            var change = last[1] - earlier[1];
            return change > 1 ? "up" : change < -1 ? "down" : "stable";
        };

        self.trendText = function (trend) {
            return { up: gettext("heating"), down: gettext("cooling"), stable: gettext("stable") }[trend];
        };

        var heaterGauge = function (key, name, icon, actual, target, max) {
            return self.makeGauge({
                name: name,
                icon: icon,
                value: function () { return actual(); },
                max: function () { return Number(max()); },
                target: function () { return target(); },
                text: function () { return Math.round(self.convertTemp(actual())); },
                unit: function () { return self.tempSymbol(); },
                targetText: function () { return target() > 0 ? "→ " + Math.round(self.convertTemp(target())) + "°" : ""; },
                ticks: function () { return self.gaugeTickPaths(); },
                color: function () { return self.heaterColor(actual(), target()); },
                history: function () {
                    actual();
                    return self.dashboardSettings.showTempHistory() ? self.historyPoints(key) : "";
                },
                trend: function () {
                    actual();
                    return self.historyTrend(key);
                }
            });
        };

        self.heaterGauges = ko.pureComputed(function () {
            var gauges = [];
            if (!self.temperatureModel.isOperational())
                return gauges;
            var settings = self.dashboardSettings;
            self.temperatureModel.tools().forEach(function (tool) {
                if (!settings.hideHotend() || tool.target() > 0)
                    gauges.push(heaterGauge(tool.key(), tool.name(), "nozzle", tool.actual, tool.target, settings.hotendTempMax));
            });
            if (self.temperatureModel.hasBed())
                gauges.push(heaterGauge("bed", self.temperatureModel.bedTemp.name(), "bed", self.temperatureModel.bedTemp.actual, self.temperatureModel.bedTemp.target, settings.bedTempMax));
            if (self.temperatureModel.hasChamber())
                gauges.push(heaterGauge("chamber", self.temperatureModel.chamberTemp.name(), "chamber", self.temperatureModel.chamberTemp.actual, self.temperatureModel.chamberTemp.target, settings.chamberTempMax));
            return gauges;
        });

        self.fanGauge = self.makeGauge({
            name: gettext("Fan"),
            icon: "fan",
            value: function () { return Number(self.fanSpeed()) || 0; },
            max: function () { return 100; },
            text: function () { return Number(self.fanSpeed()) > 0 ? Math.round(self.fanSpeed()) : gettext("Off"); },
            unit: function () { return Number(self.fanSpeed()) > 0 ? "%" : ""; }
        });

        self.sensorGauges = ko.pureComputed(function () {
            if (!self.enclosureViewModel)
                return [];
            return self.enclosureViewModel.rpi_inputs_temperature_sensors().map(function (sensor) {
                return self.makeGauge({
                    name: sensor.label,
                    icon: "thermometer",
                    value: function () { return Number(sensor.temp_sensor_temp()); },
                    max: function () { return Number(self.dashboardSettings.chamberTempMax()); },
                    text: function () { return sensor.temp_sensor_temp(); },
                    unit: function () { return sensor.use_fahrenheit() ? "°F" : "°C"; },
                    targetText: function () { return sensor.temp_sensor_humidity && sensor.temp_sensor_humidity() ? sensor.temp_sensor_humidity() + "%" : ""; }
                });
            });
        });

        // Enabled command widgets of a type, with their index into cmdResults
        var enabledCommands = function (type) {
            var commands = [];
            self.commandWidgetArray().forEach(function (command, index) {
                if (command.enabled() && self.castToWidgetTypes(command.type()) === type)
                    commands.push({ command: command, index: index });
            });
            return commands;
        };

        self.commandGauges = ko.pureComputed(function () {
            return enabledCommands(self.widgetTypes.THREE_QUARTER).map(function (item) {
                var result = function () { return Number(self.cmdResults()[item.index]); };
                return self.makeGauge({
                    name: item.command.name(),
                    icon: self.commandIcon(item.command.icon()),
                    value: result,
                    max: function () { return Number(self.dashboardSettings.chamberTempMax()); },
                    text: function () { return isNaN(result()) ? "-" : Math.round(self.convertTemp(result())); },
                    unit: function () { return self.tempSymbol(); }
                });
            });
        });

        self.commandProgress = ko.pureComputed(function () {
            return enabledCommands(self.widgetTypes.PROGRESS).map(function (item) {
                var percent = self.cmdResults()[item.index] * 100.0;
                return { label: item.command.name(), value: percent, text: self.formatPercentage(percent) };
            });
        });

        // --- Progress ---
        self.progressItems = ko.pureComputed(function () {
            var settings = self.dashboardSettings;
            var items = [];
            if (settings.showTimeProgress())
                items.push({ label: settings.showProgress() ? gettext("Time") : gettext("Job"), value: self.timeProgressString(), text: self.timeProgressBarString() });
            if (settings.showProgress())
                items.push({ label: settings.showTimeProgress() ? gettext("GCode") : gettext("Job"), value: self.printerStateModel.progressString(), text: self.printerStateModel.progressBarString() || "0%" });
            if (settings.showHeightProgress())
                items.push({ label: gettext("Height"), value: self.heightProgressString(), text: self.heightProgressBarString() });
            if (settings.showLayerProgress())
                items.push({ label: gettext("Layer"), value: self.layerProgress(), text: self.layerProgress() + "%" });
            return items;
        });

        // --- Layer graph ---
        // One bar per layer, scaled to the longest; the last finished layer is highlighted
        self.layerBars = ko.pureComputed(function () {
            var type = self.dashboardSettings.layerGraphType();
            var times = self.layerTimes();
            var labels = self.layerTimeLabels();
            var start = type == "last40layers" ? Math.max(0, times.length - 40) : 0;
            times = times.slice(start);
            labels = labels.slice(start);
            var longest = Math.max.apply(null, times.concat([1]));
            var barWidth = 10;
            // one slot per layer of the print (or 40), so the bars fill up as it goes
            var slots = type == "last40layers" ? 40 : Math.max(times.length, parseInt(self.totalLayer()) - 1 || 40);
            var bars = times.map(function (time, index) {
                var height = Math.max(1, time / longest * 96);
                return {
                    x: index * barWidth + 1,
                    w: barWidth - 2,
                    h: height.toFixed(1),
                    y: (100 - height).toFixed(1),
                    current: index == times.length - 1,
                    title: gettext("Layer") + " " + labels[index] + ": " + self.formatSeconds(time)
                };
            });
            return {
                bars: bars,
                width: (type == "scrolling" ? Math.max(times.length, 40) : slots) * barWidth,
                cssWidth: type == "scrolling" ? Math.max(100, times.length / 40 * 100) + "%" : "100%",
                first: labels.length ? gettext("Layer") + " " + labels[0] : "",
                last: type != "last40layers" && slots > times.length ? slots : labels.length ? labels[labels.length - 1] : ""
            };
        });

        self.layerGraphSummary = ko.pureComputed(function () {
            if (!self.layerTimes().length)
                return "";
            return gettext("last") + " " + self.formatSeconds(self.layerTimes()[self.layerTimes().length - 1]) + " · ⌀ " + self.formatSeconds(self.averageLayerDuration());
        });

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
            } else if (previous == "#tab_plugin_dashboard") {
                self._disableWebcam();
            };
        };


        self.renderChart = function (layerTimes, layerLabels) {
            self.layerTimes(JSON.parse(layerTimes));
            self.layerTimeLabels(JSON.parse(layerLabels));
        };

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


            // The widget settings dialog is opened on top of the settings dialog too
            $("#dashboardWidgetDialog").appendTo("body");

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

                // Esc leaves the full browser window, like it leaves fullscreen
                document.addEventListener("keydown", function (event) {
                    if (event.key == "Escape" && !$(".modal:visible").length)
                        self.toggleFullBrowserWindow();
                });
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

            // the ticks follow the setting right away, so the widget settings dialog can preview them
            self.dashboardSettings.temperatureTicks.subscribe(self.doTempGaugeTicks);

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

            if (self.isPlaced("printThumbnail")) {
                setTimeout(self.updatePrintThumbnail, 2500);
            }

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
        dependencies: ["temperatureViewModel", "printerStateViewModel", "printerProfilesViewModel", "connectionViewModel", "settingsViewModel", "controlViewModel", "enclosureViewModel", "loginStateViewModel", "accessViewModel"],
        optional: ["enclosureViewModel", "accessViewModel"],
        elements: ["#tab_plugin_dashboard", "#settings_plugin_dashboard"]
    });
});
