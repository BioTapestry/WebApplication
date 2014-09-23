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
    "../BioTapestryConstants",
    "../util/renderer_math"
], function (
    BioTapestryConstants,
    MathUtils
) {
    var _segment_key_fn = function(segment) {
        return JSON.stringify(_.pick(segment, ['islink', 'isonly', 'label']));
    };

    var _segment_point_intersect_fn = function(segment, point) {
        var dist = MathUtils.distanceFromLine({x: segment.sx, y: segment.sy}, {x: segment.ex, y: segment.ey}, point);
        return dist < (segment.selthick / 2.0);
    };

    var _linkage_point_intersect_fn = function(group, model_point) {
        var intersected_segment = _.find(group.segments, function(segment) {
            return _segment_point_intersect_fn(segment, model_point);
        });

        if (intersected_segment !== undefined) {
            return _.extend(group.getIntersection(), {
                segments: [intersected_segment]
            });
        }
        else {
            return null;
        }
    };

    var _segment_rectangle_intersect_fn = function(segment, selection_rect) {
        var min_x = _.min([segment.sx, segment.ex]),
            max_x = _.max([segment.sx, segment.ex]),
            min_y = _.min([segment.sy, segment.ey]),
            max_y = _.max([segment.sy, segment.ey]);

        return selection_rect.min_x <= min_x &&
            selection_rect.max_x >= max_x &&
            selection_rect.min_y <= min_y &&
            selection_rect.max_y >= max_y;
    };

    var _linkage_rectangle_intersect_fn = function(group, selection_rect) {
        var intersected_segments = _.filter(group.segments, function(segment) {
            return _segment_rectangle_intersect_fn(segment, selection_rect);
        });

        if (intersected_segments.length > 0) {
            return _.extend(group.getIntersection(), {
                segments: intersected_segments
            });
        }
        else {
            return null;
        }
    };

    var _get_bounds_for_segments = function(segments) {

    };

    var _get_bounding_box = function(group, segments) {

    };

    return {
        // Accessor
        get_segment_key: _segment_key_fn,

        // Point intersection
        segment_point_intersect: _segment_point_intersect_fn,
        linkage_point_intersect: _linkage_point_intersect_fn,

        // Rectangle intersection
        segment_rectangle_intersect: _segment_rectangle_intersect_fn,
        linkage_rectangle_intersect: _linkage_rectangle_intersect_fn,

        get_bounding_box: _get_bounding_box
    };

// end define
});
