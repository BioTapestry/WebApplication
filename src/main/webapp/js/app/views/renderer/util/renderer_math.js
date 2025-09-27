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
    var _sqr = function(x) {
        return x * x;
    };

    var _pointDist = function(p1, p2) {
        return _sqr(p1.x - p2.x) + _sqr(p1.y - p2.y);
    };

    var _distanceFromLineSquared =function(l1, l2, p) {
        var line_dist = _pointDist(l1, l2);

        if (line_dist == 0.0) {
            return _pointDist(p, l1);
        }

        var t = (  (p.x - l1.x) * (l2.x - l1.x) + (p.y - l1.y) * (l2.y - l1.y)   ) / line_dist;

        if (t < 0) {
            return _pointDist(p, l1);
        }

        if (t > 1) {
            return _pointDist(p, l2);
        }

        return _pointDist(p, {
            x: l1.x + t * (l2.x - l1.x),
            y: l1.y + t * (l2.y - l1.y)
        });
    };

    return {
        //
        // x: number
        //
        // Return: x squared
        //
        sqr: _sqr,

        //
        // p1: point
        // p2: point
        //
        // Returns: distance between p1 and p2
        //
        pointDist: _pointDist,

        //
        // l1: line end point 1
        // l2: line end point 2
        // p: point
        distanceFromLine: function(l1, l2, p) {
            return Math.sqrt(_distanceFromLineSquared(l1, l2, p));
        }
    };
// end define
});