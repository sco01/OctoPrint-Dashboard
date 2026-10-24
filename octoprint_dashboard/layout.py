# coding=utf-8

#  OctoPrint-Dashboard
#
#  Authors:
#   - Jefferey Neuffer (https://github.com/j7126)
#   - Will MacCormack (https://github.com/willmac16)
#   - Stefan Cohen (https://github.com/StefanCohen)
#
#  Copyright (C) 2024
#
#  This program is free software: you can redistribute it and/or modify
#  it under the terms of the GNU Affero General Public License as
#  published by the Free Software Foundation, either version 3 of the
#  License, or (at your option) any later version.
#
#  This program is distributed in the hope that it will be useful,
#  but WITHOUT ANY WARRANTY; without even the implied warranty of
#  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#  GNU Affero General Public License for more details.
#
#  You should have received a copy of the GNU Affero General Public License
#  along with this program.  If not, see <https://www.gnu.org/licenses/>.

"""
Dashboard layouts.

A layout is an ordered list of placed widgets, one for the tab and one for fullscreen and the full browser
window. Each placement is a dict with the widget id, its size ("<columns>x<rows>" on a four column grid) and
whether it is only shown while printing. Widgets that are not placed are hidden.

Before layouts, each widget had a show, a fullscreen and a "printing only" setting. LEGACY_WIDGETS maps
those settings to widget ids, so existing setups can be converted and the default layout looks like the
old default.
"""

from __future__ import absolute_import, unicode_literals

SIZES = ["1x1", "2x1", "3x1", "4x1", "1x2", "2x2", "3x2", "4x2", "2x3", "3x3", "4x3"]

# id, show setting(s), fullscreen setting, printing only setting, size in the tab, size in fullscreen
LEGACY_WIDGETS = [
    ("systemInfo", ["showSystemInfo"], "fsSystemInfo", "printingOnly_SystemInfo", "4x1", "4x1"),
    ("status", ["showStatus"], "fsStatus", "printingOnly_Status", "4x1", "4x1"),
    ("jobControlButtons", ["showJobControlButtons"], "fsJobControlButtons", "printingOnly_JobControlButtons", "4x1", "4x1"),
    ("tempGauges", ["enableTempGauges"], "fsTempGauges", "printingOnly_TempGauges", "3x1", "3x1"),
    ("fan", ["showFan"], "fsFan", "printingOnly_Fan", "1x1", "1x1"),
    ("sensorInfo", ["showSensorInfo"], "fsSensorInfo", "printingOnly_SensorInfo", "4x1", "4x1"),
    ("commandWidgets", ["showCommandWidgets"], "fsCommandWidgets", "printingOnly_CommandWidgets", "4x1", "4x1"),
    ("printerMessage", ["showPrinterMessage"], "fsPrinterMessage", "printingOnly_PrinterMessage", "4x1", "4x1"),
    (
        "progressGauges",
        ["showTimeProgress", "showProgress", "showLayerProgress", "showHeightProgress"],
        "fsProgressGauges",
        "printingOnly_ProgressGauges",
        "4x1",
        "4x1",
    ),
    ("layerGraph", ["showLayerGraph"], "fsLayerGraph", "printingOnly_LayerGraph", "4x1", "4x1"),
    ("fileName", ["showFileName"], "fsFileName", "printingOnly_FileName", "4x1", "4x1"),
    ("printThumbnail", ["showPrintThumbnail"], "fsPrintThumbnail", None, "2x1", "2x1"),
    ("filament", ["showFilament"], "fsFilament", "printingOnly_Filament", "2x1", "2x1"),
    ("feedrate", ["showFeedrate"], "fsFeedrate", "printingOnly_Feedrate", "2x1", "2x1"),
    ("timeEstimate", ["showTimeEstimate"], "fsTimeEstimate", "printingOnly_TimeEstimate", "4x1", "4x1"),
    ("layerInfo", ["showLayerInfo"], "fsLayerInfo", "printingOnly_LayerInfo", "4x1", "4x1"),
    ("webcam", ["showWebCam"], "fsWebCam", "printingOnly_WebCam", "4x2", "2x2"),
]


def layout_from_legacy(get):
    """
    Builds the tab and fullscreen layouts from the old per widget settings. get(key) returns a setting.
    In fullscreen the webcam goes first, the old fullscreen view gave it half the screen.
    """
    tab = []
    full = []
    for widget_id, show, fs, printing_only, tab_size, full_size in LEGACY_WIDGETS:
        if not any(get(key) for key in show):
            continue
        only = bool(get(printing_only)) if printing_only else False
        tab.append(dict(id=widget_id, size=tab_size, printingOnly=only))
        if get(fs):
            placement = dict(id=widget_id, size=full_size, printingOnly=only)
            if widget_id == "webcam":
                full.insert(0, placement)
            else:
                full.append(placement)
    return dict(tab=tab, full=full)


def is_placed(layout, widget_id):
    """True if the widget is placed in the tab or the fullscreen layout."""
    for name in ("tab", "full"):
        for placement in (layout or {}).get(name) or []:
            if placement.get("id") == widget_id:
                return True
    return False
