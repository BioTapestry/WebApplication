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

], function (

) {
    ///////////////////////////////////
    // FontUtils
    ///////////////////////////////////
    //
    // A module converting exported font objects to CSS font shorthand.
    //

    return {

        ////////////////////////////////
        // makeFontDescriptor
        ////////////////////////////////
        //
        // Builds a CSS font shorthand string from given font object.
        //
        makeFontDescriptor: function(font) {
            var size = font.point_size;

            var types = [
                // SANS_SERIF = 0
                function(size) {
                    return size + "pt sans-serif";
                },
                // SERIF = 1
                function(size) {
                    return size + "pt serif";
                },

                // SANS_SERIF_BOLD = 2
                function(size) {
                    return "bold " + size + "pt sans-serif";
                },
                // SERIF_BOLD = 3
                function(size) {
                    return "bold " + size + "pt serif";
                },

                // SANS_SERIF_ITALIC = 4
                function(size) {
                    return "italic " + size + "pt sans-serif";
                },
                // SERIF_ITALIC = 5
                function(size) {
                    return "italic " + size + "pt serif";
                },

                // SANS_SERIF_BOLD_ITALIC = 6
                function(size) {
                    return "bold italic " + size + "pt sans-serif";
                },
                // SERIF_BOLD_ITALIC = 7
                function(size) {
                    return "bold italic " + size + "pt serif";
                }
            ];

            return types[font.type](size);
        }
    }
});
