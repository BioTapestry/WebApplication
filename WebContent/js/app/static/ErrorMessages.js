/*
**    Copyright (C) 2003-2015 Institute for Systems Biology 
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

// Static file for longer error messages in pre-formatted HTML

define([],function(){
	
	return {
		// Displayed error messages
		no_canvas: "<p>Your browser does not appear to support <a href=\"http://www.w3schools.com/html/html5_canvas.asp\" " 
			+ "target=\"_BLANK\">HTML5's Canvas</a> feature, which is an essential element of the BioTapestry Web Application. "
			+ "If you can install an alternative browser or update your current one, the following should support "
			+ "HTML5 Canvas: "
			+ "<ul><li>Internet Explorer 9 and newer"
			+ "<li>Mozilla Firefox 18.0 and newer"
			+ "<li>Google Chrome 24.0 and newer"
			+ "<li>Safari 5.1 and newer</ul>"
			+ "If these web browsers are not available to you (or you cannot install them), "
			+ "the <a href=\"http://www.biotapestry.org\" target=\"_BLANK\">Java Webstart version of BioTapestry</a> is available "
			+ "(requires Java 1.5 or newer).</p>"
			
		,comp_view: "<p>The BioTapestry Web Application cannot run in " 
			+ "<a href=\"http://www.sevenforums.com/tutorials/1196-internet-explorer-compatibility-view-turn-off.html\""
			+ "target=\"_BLANK\">Compatibility View</a>. Please disable Compatibility View and reload the page.</p>"
			
		,load: "<p>An error has prevented loading of the BioTapestry Web Application. Please copy this text into an email and "
			+ "<A HREF=\"mailto:biotapestry@systemsbiology.org.\">email it to us</A>.</p>"
			
		,popupsBlocked: "<p><b>Your browser appears to be blocking pop-ups. This data has been opened in a dialog window instead, " +
			"though subsequent data may display in its own window.</b></p>"
		
		,initFailed: "<p>Initialization of the browser's session appears to have failed. Clear your cookies and try reloading the page.</p>" +
			"<p>If this problem persists, contact the system administrator.</p>"
		
		// Console error messages
		,loadFailed: "[ERROR] While loading the interface: "
			
		,sessionNotReady: "[ERROR] Session did not return ready!"
			
		,originMismatch: "[ERROR] Origin mismatch in message! This might be an attack!"
			
		,CanvasReadyErr: "[ERROR] Canvas failed to ready in "
			
		,ActionFailModeNotEd: "[ERROR] This action can only be performed in Editor Mode!"
	
	};	

});