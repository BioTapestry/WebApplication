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

    var update_bounds = function(currentbounds, bound_limits) {
        var min_x = bound_limits.min_x,
            max_x = bound_limits.max_x,
            min_y = bound_limits.min_y,
            max_y = bound_limits.max_y;

        if (min_x < currentbounds.min_x) {
            currentbounds.min_x = min_x;
        }
        if (max_x > currentbounds.max_x) {
            currentbounds.max_x = max_x;
        }

        if (min_y < currentbounds.min_y) {
            currentbounds.min_y = min_y;
        }
        if (max_y > currentbounds.max_y) {
            currentbounds.max_y = max_y;
        }
    };

    var update_bounds_rectangle = function(currentbounds, boundshape) {
        update_bounds(currentbounds, {
            min_x: boundshape.x,
            min_y: boundshape.y,
            max_x: boundshape.x + boundshape.w,
            max_y: boundshape.y + boundshape.h
        });
    };

    var update_bounds_ellipse = function(currentbounds, boundshape) {
        update_bounds(currentbounds, {
            min_x: boundshape.cx - boundshape.r,
            min_y: boundshape.cy - boundshape.r,
            max_x: boundshape.cx + boundshape.r,
            max_y: boundshape.cy + boundshape.r
        });
    };

    var update_bounds_line = function(currentbounds, boundshape) {
        update_bounds(currentbounds, {
            min_x: _.min([boundshape.x1, boundshape.x2]),
            max_x: _.max([boundshape.x1, boundshape.x2]),
            min_y: _.min([boundshape.y1, boundshape.y2]),
            max_y: _.max([boundshape.y1, boundshape.y2])
        });
    };

    var _find_maximal_bounds = function(boundlist) {
        return _.chain(boundlist)
            .reduce(function(bounds_memo, boundshape) {
                var shape_type = boundshape.type;

                // Rectangle - x, y, w, h
                if (shape_type == 'rect') {
                    update_bounds_rectangle(bounds_memo, boundshape);
                }
                // Rectangle - min_x, max_x, min_y, max_y
                if (shape_type == 'rect2') {
                    update_bounds(bounds_memo, boundshape);
                }
                else if (shape_type == 'ellipse') {
                    update_bounds_ellipse(bounds_memo, boundshape);
                }
                else if (shape_type == 'line') {
                    update_bounds_line(bounds_memo, boundshape);
                }

                return bounds_memo;
            }, {
                min_x: Infinity,
                max_x: -Infinity,
                min_y: Infinity,
                max_y: -Infinity,
                type: 'rect2'
            })
            .value();
    };

    return {
        getMaximalBounds: _find_maximal_bounds
    };

// end define
});