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

    var check_rectangle_normal = function(selection_rect, boundrect) {
        return selection_rect.min_x <= boundrect.min_x &&
            selection_rect.max_x >= boundrect.max_x &&
            selection_rect.min_y <= boundrect.min_y &&
            selection_rect.max_y >= boundrect.max_y;
    };

    var check_rectangle = function(selection_rect, boundrect) {
        var min_x = boundrect.x,
            min_y = boundrect.y,
            max_x = boundrect.x + boundrect.w,
            max_y = boundrect.y + boundrect.h;

        return selection_rect.min_x <= min_x &&
            selection_rect.max_x >= max_x &&
            selection_rect.min_y <= min_y &&
            selection_rect.max_y >= max_y;
    };

    var check_ellipse = function(selection_rect, boundshape) {
        var min_x = boundshape.cx - boundshape.r,
            min_y = boundshape.cy - boundshape.r,
            max_x = boundshape.cx + boundshape.r,
            max_y = boundshape.cy + boundshape.r;

        return selection_rect.min_x <= min_x &&
            selection_rect.max_x >= max_x &&
            selection_rect.min_y <= min_y &&
            selection_rect.max_y >= max_y;
    };

    var is_point_in_rectangle = function(point, rectangle) {
        return rectangle.min_x <= point.x &&
            rectangle.max_x >= point.x &&
            rectangle.min_y <= point.y &&
            rectangle.max_y >= point.y;
    };

    var is_point_in_rectangle_wh = function(point, rectangle) {
        var min_x = rectangle.x,
            min_y = rectangle.y,
            max_x = rectangle.x + rectangle.w,
            max_y = rectangle.y + rectangle.h;

        return min_x <= point.x &&
            max_x >= point.x &&
            min_y <= point.y &&
            max_y >= point.y;
    };

    return {
        isPointInRectangle: is_point_in_rectangle,
        isPointInRectangleWH: is_point_in_rectangle_wh,

        rectangleIntersect: function(node, selection_rect) {
            var is_fitting = _.reduce(node.bounds, function(all_bounds_fit, boundshape) {
                var shape_type = boundshape.type,
                    selection_type = boundshape.s || null;

                if (shape_type == 'ellipse') {
                    all_bounds_fit = all_bounds_fit && check_ellipse(selection_rect, boundshape);
                }
                // The selection type property is only applicable to rectangle bounding shapes, as
                // rectangles are the only ones also used to denote node label bounds.
                else if (shape_type == 'rect' && selection_type == 'GLYPH') {
                    all_bounds_fit = all_bounds_fit && check_rectangle(selection_rect, boundshape);
                }
                else if (shape_type == 'rect2' && selection_type == 'GLYPH') {
                    all_bounds_fit = all_bounds_fit && check_rectangle_normal(selection_rect, boundshape);
                }
                
                return all_bounds_fit;
            }, true);
            
            if (is_fitting) {
                return _.extend(node.getIntersection(), {
                    source: 'rect'
                });
            }
            else {
                return null;
            }
        }
    };

// end define
});
