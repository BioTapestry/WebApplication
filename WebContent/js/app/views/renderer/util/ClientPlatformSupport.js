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
    // ClientPlatformSupport
    ///////////////////////////////////
    //
    // A module for detecting the operating system of the client.
    //

    var CLIENT_OPERATING_SYSTEM = "Unknown OS";
    if (navigator.appVersion.indexOf("Win") != -1) {
        console.log("ClientPlatformSupport - detected Windows");
        CLIENT_OPERATING_SYSTEM="win";
    }
    if (navigator.appVersion.indexOf("Mac") != -1) {
        console.log("ClientPlatformSupport - detected OSX");
        CLIENT_OPERATING_SYSTEM="osx";
    }
    if (navigator.appVersion.indexOf("X11") != -1) {
        console.log("ClientPlatformSupport - detected X11");
        CLIENT_OPERATING_SYSTEM="x11";
    }
    if (navigator.appVersion.indexOf("Linux") != -1) {
        console.log("ClientPlatformSupport - detected Linux");
        CLIENT_OPERATING_SYSTEM="linux";
    }

    return {
        ////////////////////////////////
        // getOS
        ////////////////////////////////
        //
        // Returns the detected operating client operating system.
        //
        getOS: function() {
            return CLIENT_OPERATING_SYSTEM;
        }
    };
});
