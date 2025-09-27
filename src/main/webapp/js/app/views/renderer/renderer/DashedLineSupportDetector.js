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

], function(

) {
    var SUPPORT_SETLINEDASH = 0;
    var SUPPORT_MOZDASH = 1;
    var SUPPORT_EMULATED = 2;

    var supported;

    if (!CanvasRenderingContext2D.prototype.hasOwnProperty("setLineDash")) {
        if (CanvasRenderingContext2D.prototype.hasOwnProperty("mozDash")) {
            console.log("CanvasRenderingContext2D does not have setLineDash - using mozDash instead");

            CanvasRenderingContext2D.prototype.setLineDash = function (segments) {
                this.mozDash = segments;
            };
            CanvasRenderingContext2D.prototype.setLineDashOffset = function (offset) {
                this.mozDashOffset = offset;
            };

            supported = SUPPORT_MOZDASH;
        }
        else {
            console.log("CanvasRenderingContext2D does not support dashed line style - using bitmap pattern emulation");
            supported = SUPPORT_EMULATED;
        }
    }
    else {
        console.log("Detected setLineDash support in CanvasRenderingContext2D");
        supported = SUPPORT_SETLINEDASH;
    }

    return {
        SETLINEDASH: SUPPORT_SETLINEDASH,
        MOZDASH: SUPPORT_MOZDASH,
        EMULATED: SUPPORT_EMULATED,
        getSupportLevel: function() {
            return supported;
        }
    };
});
