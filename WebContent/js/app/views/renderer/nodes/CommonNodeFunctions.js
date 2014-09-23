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
    "../fonts/BioTapestryDefaultFonts",
    "./LinkageIntersection",
    "./ShapeFactory",
    "./PointSelection",
    "./RectangleSelection",
    "./ShapeRendererFunctions",
    "../renderer/SelectedBoundsSupport"
], function (
    BioTapestryDefaultFonts,
    LinkageIntersection,
    ShapeFactory,
    PointSelection,
    RectangleSelection,
    ShapeRendererFunctions,
    SelectedBoundsSupport
) {
    var _getType = function () {
        return this._type;
    };

    var _getName = function () {
        return this.name;
    };

    var _getChildID = function() {
        return this.childid;
    };

    return {
        _render: function (rc, intersection) {
            if (intersection !== undefined && intersection !== null) {
                this._renderSelected(rc, intersection);
            }

            _.each(this.base, function (shape) {
                shape.render(rc, this);
            }, this);
        },

        _renderSelected: function (rc, intersection) {
            _.each(this.selected, function (shape) {
                shape.render(rc, this);
            }, this);
        },

        _getType: _getType,

        _getName: _getName,

        _getDefaultFont: function (rc) {
            return BioTapestryDefaultFonts.getDefault(this.default_font);
        },

        _getIntersection: function () {
            return {
                _type: this._type,
                id: this.id,
                name: this.name,
                getType: _getType,
                getName: _getName
            };
        },

        _pointIntersect: function (model_point) {
            return PointSelection._pointIntersectGroup(this, model_point);
        },

        _rectangleIntersect: function (selection_rect) {
            return RectangleSelection.rectangleIntersect(this, selection_rect);
        },

        _getMaximalBounds: function (intersection) {
            return SelectedBoundsSupport.getMaximalBounds(this.bounds);
        },

        _getLayer: function () {
            return this.layer;
        },

        _getOrder: function () {
            return this.order;
        },

        _getChildID: _getChildID
    }
});