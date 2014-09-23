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
    return {
        /**
         * Iterative hit search for rects, ellipses, and circles
         *
         *
         *
         * @param node
         * @param point
         * @returns Intersection object or null
         *
         */
        _pointIntersectGroup: function(node, point) {
            var is_found = false;
            _.each(node.bounds, function(bound) {
                switch(bound.type) {
                    case "circle":
                    case "ellipse":
                        var xRad = (bound.r ? bound.r : bound.rx);
                        var yRad = (bound.r ? bound.r : bound.ry);
                        if (
                            (Math.pow((bound.cx - point.x),2)/Math.pow(xRad,2)) +
                            (Math.pow((bound.cy - point.y),2)/Math.pow(yRad,2))
                            <= 1.0
                        ) {
                            is_found = true;
                        }
                        break;

                    case "rectangle":
                    case "rect":
                        var max_x = bound.x + bound.w,
                            max_y = bound.y + bound.h;

                        if ( parseFloat(bound.x) <= point.x
                            && parseFloat(max_x) >= point.x
                            && parseFloat(bound.y) <= point.y
                            && parseFloat(max_y) >= point.y) {

                            is_found = true;
                        }
                        break;
                    case "rect2":
                        if(parseFloat(bound.min_x) <= point.x
                            && parseFloat(bound.max_x) >= point.x
                            && parseFloat(bound.min_y) <= point.y
                            && parseFloat(bound.max_y) >= point.y) {

                            is_found = true;
                        }
                        break;

                    return null;
                }
                
            });
            
            if (is_found) {
                return _.extend(node.getIntersection(), {
                    source: 'point'
                });
            }
            else {
                return null;
            }
        }
    };

// end define
});
