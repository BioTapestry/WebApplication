/*
 **    Copyright (C) 2003-2014 Institute for Systems Biology
 **                            Seattle, Washington, USA.
 **
 **    This library is free software; you can redistribute it and/or
 **    modify it under the terms of the GNU Lesser General Public
 **    License as published by the Free Software Foundation; either
 **    version 2.1 of the License, or (at your option) any later version.
 **
 **    This library is distributed in the hope that it will be useful,
 **    but WITHOUT ANY WARRANTY; without even the implied warranty of
 **    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 **    Lesser General Public License for more details.
 **
 **    You should have received a copy of the GNU Lesser General Public
 **    License along with this library; if not, write to the Free Software
 **    Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
*/

define([
    "./NetModuleCommon"
], function(
    NetModuleCommon
) {
    ///////////////////////////////////
    // AlphaBuilder
    ///////////////////////////////////
    //
    // A module for calculating the alpha values for network module components
    //


    ////////////////////////////////////////////////////////////////////////////
    // Private constants
    ////////////////////////////////////////////////////////////////////////////

    var LABEL_START_     = 1.00;
    var LABEL_END_       = 0.80;
    var LABEL_FLOOR_VAL_ = 0.00;

    var FILL_START_      = 1.00;
    var FILL_END_        = 0.50;
    var FILL_FLOOR_VAL_  = 0.00;

    var BOUND_START_     = 0.40;
    var BOUND_END_       = 0.00;
    var BOUND_FLOOR_VAL_ = 0.10;

    var BACK_START_      = 0.60;
    var BACK_END_        = 0.40;
    var BACK_FLOOR_VAL_  = 0.00;

    var AlphaBuilderPrototype = {
        ////////////////////////////////
        // alphaCalc
        ////////////////////////////////
        //
        // Calculate individual values from a single master value.
        //
        // Result is stored in the "settings" parameter.
        //
        alphaCalc: function(masterVal, settings) {
            if ((masterVal < 0.0) || (masterVal > 100.0)) {
                throw {
                    name: 'Invalid Overlay Alpha Error',
                    level: 'Overlay.AlphaBuilder',
                    message: 'Invalid alpha value ' + masterVal + ', must be between 0.0 and 100.0',
                    htmlMessage: 'Invalid alpha value <b>' + masterVal + '</b>, must be between 0.0 and 100.0',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }

            var masterFraction = masterVal / 100.0;

            settings.regionFillAlpha = this.calcRegionFill(masterFraction);
            settings.regionBoundaryAlpha = this.calcRegionBoundary(masterFraction);
            settings.regionLabelAlpha = this.calcFastLabel(masterFraction);
            settings.fastDecayLabelVisible = (settings.regionLabelAlpha > 0.0);
            settings.backgroundOverlayAlpha = this.calcBackground(masterFraction);

            var maskCutoff = NetModuleCommon.Settings.INTERSECTION_CUTOFF;
            if (settings.regionFillAlpha > maskCutoff) {
                settings.intersectionMask = NetModuleCommon.Settings.ALL_MASKED;
            } else if (settings.backgroundOverlayAlpha > maskCutoff) {
                settings.intersectionMask = NetModuleCommon.Settings.NON_MEMBERS_MASKED;
            } else {
                settings.intersectionMask = NetModuleCommon.Settings.NOTHING_MASKED;
            }
        },

        ////////////////////////////////
        // modContentsMasked
        ////////////////////////////////
        //
        // Answer if the alpha settings are consistent with hidden module contents
        //
        modContentsMasked: function(settings) {
            return (settings.regionFillAlpha > FILL_FLOOR_VAL_);
        },

        ////////////////////////////////
        // calcRegionFill
        ////////////////////////////////
        //
        // Get the region fill transparency
        //
        calcRegionFill: function(masterFraction) {
            return this.calcPiecewise(masterFraction, FILL_START_, FILL_END_, FILL_FLOOR_VAL_);
        },

        ////////////////////////////////
        // calcRegionBoundary
        ////////////////////////////////
        //
        // Get the region boundary transparency
        //
        calcRegionBoundary: function(masterFraction) {
            return this.calcPiecewise(masterFraction, BOUND_START_, BOUND_END_, BOUND_FLOOR_VAL_);
        },
        ////////////////////////////////
        // calcFastLabel
        ////////////////////////////////
        //
        // Get the region label transparency for quickly attenuated labels
        //
        calcFastLabel: function(masterFraction) {
            return this.calcPiecewise(masterFraction, LABEL_START_, LABEL_END_, LABEL_FLOOR_VAL_);
        },

        ////////////////////////////////
        // calcBackground
        ////////////////////////////////
        //
        // Get the opaque background transparency
        //
        calcBackground: function(masterFraction) {
            return this.calcPiecewise(masterFraction, BACK_START_, BACK_END_, BACK_FLOOR_VAL_);
        },

        ////////////////////////////////
        // calcPiecewise
        ////////////////////////////////
        //
        // Piecewise linear reduction
        //
        calcPiecewise: function(masterFraction, startx, endx, yFloor) {
            if (masterFraction > startx) {
                return (1.0);
            }
            else if (masterFraction < endx) {
                return (yFloor);
            }
            else {
                var xfrac = (masterFraction - endx) / (startx - endx);
                var delY = 1.0 - yFloor;
                return (yFloor + (delY * xfrac));
            }
        }
    };

    return Object.create(AlphaBuilderPrototype, {});
});