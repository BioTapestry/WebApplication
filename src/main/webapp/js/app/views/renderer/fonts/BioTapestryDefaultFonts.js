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
    // BioTapestryDefaultFonts
    ///////////////////////////////////
    //
    // A module containing the default and fixed fonts.
    //

    var default_fonts = [
        {"size": 20, "style": 1, "type": 3},
        {"size": 28, "style": 1, "type": 3},
        {"size": 28, "style": 1, "type": 3},
        {"size": 28, "style": 1, "type": 3},
        {"size": 28, "style": 1, "type": 3},
        {"size": 30, "style": 1, "type": 2},
        {"size": 34, "style": 1, "type": 2},
        {"size": 34, "style": 1, "type": 2},
        {"size": 34, "style": 1, "type": 2},
        {"size": 25, "style": 0, "type": 0},
        {"size": 32, "style": 1, "type": 2}
    ];

    var default_keys = {
        SMALL: 0,
        MEDIUM: 1,
        MODULE_NAME: 2,
        GENE_NAME: 3,
        LINK_LABEL: 4,
        MED_LARGE: 5,
        NET_MODULE: 6,
        LARGE: 7,
        NOTES: 8,
        DATE: 9,
        TITLE: 10
    };

    // Fixed fonts
    // ===========
    var default_fixed_fonts = [
        {"size": 10, "style": 0, "type": 0},
        {"size": 12, "style": 0, "type": 0},
        {"size": 12, "style": 0, "type": 1},
        {"size": 20, "style": 1, "type": 0},
        {"size": 16, "style": 1, "type": 0},
        {"size": 14, "style": 1, "type": 0},
        {"size": 60, "style": 1, "type": 3}
    ];

   var  fixed_keys = {
        TREE: 0,
        STRIP_CHART: 1,
        STRIP_CHART_AXIS: 2,
        WORKSHEET_TITLES_LARGE: 3,
        WORKSHEET_TITLES_MED: 4,
        WORKSHEET_TITLES_SMALL: 5,
        TOPO_BUBBLES: 6
    };

    return {
        getDefaultFontIndex: function(default_font_key) {
            return default_keys[default_font_key];
        },

        getDefaultFont: function(font_type_key) {
            if (_.has(default_keys, font_type_key)) {
                return default_fonts[default_keys[font_type_key]];
            }
            else {
                throw {
                    name: 'Unknown Default Font Type Key',
                    level: 'Renderer',
                    message: 'Tried to get default font with unknown key \'' + font_type_key + '\'',
                    htmlMessage: 'Tried to get default font with unknown key <b>' + font_type_key + '</b>',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }
        },

        getFixedDefaultFont: function(font_type_key) {
            if (_.has(fixed_keys, font_type_key)) {
                return default_fixed_fonts[fixed_keys[font_type_key]];
            }
            else {
                throw {
                    name: 'Unknown Default Fixed Font Type Key',
                    level: 'Renderer',
                    message: 'Tried to get default fixed font with unknown key \'' + font_type_key + '\'',
                    htmlMessage: 'Tried to get default fixed font with unknown key <b>' + font_type_key + '</b>',
                    toString: function(){return this.name + ": " + this.message;}
                };
            }
        }
    };
});
