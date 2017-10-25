/*
 **    Copyright (C) 2003-2016 Institute for Systems Biology
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

], function (

) {
    ///////////////////////////////////
    // Color
    ///////////////////////////////////
    //
    // Module for representing a color using a R, G, B triplet.
    //
    ////////////////////////////////
    var ColorPrototype = {
        getRed: function() {
            return this.r;
        },

        getGreen: function() {
            return this.g;
        },

        getBlue: function() {
            return this.b;
        },

        equals: function(color) {
            return color['r'] == this.r &&
                color['g'] == this.g &&
                color['b'] == this.b;
        }
    };

    return {
        ///////////////////////////////////
        // build
        ///////////////////////////////////
        //
        // Factory method for building a Color instance from a R, G, B triplet.
        //
        ////////////////////////////////
        build: function(r, g, b) {
            var color = Object.create(ColorPrototype, {});

            color.r = r;
            color.g = g;
            color.b = b;

            return color;
        },

        ///////////////////////////////////
        // build
        ///////////////////////////////////
        //
        // Factory method for building a Color instance from a R, G, B triplet stored
        // in an array in that order.
        //
        ////////////////////////////////
        buildFromArrayRGB: function(color_array) {
            var color = Object.create(ColorPrototype, {});

            color.r = color_array[0];
            color.g = color_array[1];
            color.b = color_array[2];

            return color;
        }
    };

// end define
});
