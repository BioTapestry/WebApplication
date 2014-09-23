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

////////////////////////////////////
// XhrUris
/////////////////////////////////////
//
// Static file for constructing/fetching all servlet URIs

define([],function(){

	var SERVLET_BASE_DEF = "BioTapServlet?target=";
	
	var FULL_SERVLET_PATH;
	
	var BASE_LOCATION = window.location.href;
	
	if(window.location.href.indexOf("?")>= 0) {
		BASE_LOCATION = window.location.href.substring(0,window.location.href.indexOf("?")+"/");
	}
	
	var servletBase_ = SERVLET_BASE_DEF;
	
	return {	
		init: servletBase_ + "init",
		
		modelannotimg: servletBase_ + "modelannotimage&model=",
		
		disableSessionEpiry: servletBase_ + "disablesessionexpiry",
		
		setSessionEpiry: function(expiry) {
			 return servletBase_ + "setsessionexpiry&expiry=" + expiry;
		},
		
		filelist: servletBase_ + "filelist",
		
		openfile: function(filename) {
			return servletBase_ + "openfile&filename="+filename;
		},
		
		menubar: servletBase_ + "menuDef&menuClass=MenuBar",
		
		modeltree: servletBase_ + "modelTree",
		
		setModel: function(modelId,otherArgs) {
			var args = "";
			if(otherArgs) {
				for(var i in otherArgs) {
					if(otherArgs.hasOwnProperty(i)) {
						args += "&"+i+"="+otherArgs[i];
					}
				}
			}
			return servletBase_ + "command&cmdClass=OTHER&cmdKey=MODEL_SELECTION&modelID=" + modelId + args;
		},
		
		expData: BASE_LOCATION + "expdata/",
		
		pathing: BASE_LOCATION + "pathing/",
		
		getModel: servletBase_ + "getModel",
		
		toolbar: servletBase_ + "menuDef&menuClass=ToolBar",
		
		modelImage: function(modelId) {
			return servletBase_ + "modelImage" 
				+ (modelId ? "&model="+modelId : "");
		},
		
		modelJson: function(modelId) {
			if(modelId) {
				return servletBase_ + "modelJson&model="+modelId;
			}
			return servletBase_ + "modelJson";
		},
				
		// Build the popObjID and objubID of a link segment
		linkIdUri: function(link) {
			var objSubID = "{" 
				+ "class:org.systemsbiology.biotapestry.ui.LinkSegmentID" 
				+ ",isLink:" + link.segments[0].islink
				+ ",isOnly:" + link.segments[0].isonly
				+ (link.segments[0].label === "null" ? "" : ",label:\"" + link.segments[0].label + "\"")
				+ "}";	
			return "objID=" + link.id + "&objSubID=" + objSubID;
		},

		
		// Build a popup menu request
		popup: function(nodeType,hit,clientstate) {
			var subObjId = null;
			if(hit.getType() === "linkage") {
				subObjId = "{" + 
					"class:org.systemsbiology.biotapestry.ui.LinkSegmentID" + 
					",isLink:" + hit.segments[0].islink +
					",isOnly:" + hit.segments[0].isonly +
					(hit.segments[0].label === "null" ? "" : ",label:\"" + hit.segments[0].label + "\"")
				+ "}";
			}
			return servletBase_ + "menuDef&menuClass=PopupMenu"
			+ "&popClass=" + nodeType 
			+ (hit ? ("&popObjID=" + (hit.getChildID ? hit.getChildID() : hit.id) + (subObjId ? "&objSubID="+subObjId : "")) : "")
			+ (clientstate ? "&clientstate=true" : "");
		},
		
		modelTreeContext: function(modelId) {
			return servletBase_ + "menuDef&menuClass=ModelTreeMenu&popObjID=" + modelId;
		},
		
		// Build a dialog box request
		getDialog: function(dialogType) {
			return servletBase_ + "dialogDef&dialogClass="
			+ dialogType;
		},
		
		mapLinks: function(linkIds,modelId) {			
			return servletBase_ + "linksToIntersections&linkID=" + linkIds.join("+") + "&model=" + modelId;
		},
				
		cmd: function(cmdClass,actionKey,args) {
			var uri=servletBase_ + "command&cmdClass=" + cmdClass + "&cmdKey=" + actionKey;
			if(args) {
				for(var i in args) {
					if(args.hasOwnProperty(i)) {
						if(i === "uri") {
							uri+="&"+args.uri;
						} else {
							uri+= "&" + i + "=" + args[i];
						}
					}
				}
			}
			return uri;
		},
		
		uploadFile: servletBase_ + "uploadfile",
		
		setFullServletPath: function(fullpath) {
			if(fullpath.indexOf("?")>= 0) {
				fullpath = fullpath.substring(0,fullpath.indexOf("?")+"/");
			}
			FULL_SERVLET_PATH = fullpath+SERVLET_BASE_DEF;	
		},
				
		setServletBaseToDefault: function() {
			servletBase_ = SERVLET_BASE_DEF;
		},
		
		setServletBaseToFullPath: function() {
			if(FULL_SERVLET_PATH) {
				servletBase_ = FULL_SERVLET_PATH;
			}
		}
	};
});