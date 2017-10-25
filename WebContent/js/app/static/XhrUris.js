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

////////////////////////////////////
// XhrUris
/////////////////////////////////////
//
// Static file for constructing/fetching all servlet URIs

define([],function(){

	var SERVLET_BASE_DEF = "BioTapServlet?target=";
	
	var FULL_SERVLET_PATH;
	
	var BASE_LOCATION = window.location.href;
	
	// If this was opened in an iframe, we need to trim the location href for opening experimental
	// data or pathing windows
	if(window.location.href.indexOf("?")>= 0) {
		BASE_LOCATION = window.location.href.substring(0,window.location.href.indexOf("?")+"/");
	}
	
	var servletBase_ = SERVLET_BASE_DEF;
	
	return {	
		init: servletBase_ + "init",
		
		modelannotimg: function(model,tab) {
			var uri = servletBase_ + "modelannotimage&modelID="+model;
			if(tab !== undefined && tab !== null) {
				uri+="&currentTab="+tab;
			}
			return uri;
		},

		groupnodeimg: function(node,tab) {
			var uri = servletBase_ + "groupnodeimage&type=image&nodeID="+node;
			if(tab !== undefined && tab !== null) {
				uri+="&currentTab="+tab;
			}
			return uri;
		},

		groupnodemap: function(node,tab) {
			var uri = servletBase_ + "groupnodeimage&type=map&nodeID="+node;
			if(tab !== undefined && tab !== null) {
				uri+="&currentTab="+tab;
			}
			return uri;
		},

		disableSessionEpiry: servletBase_ + "disablesessionexpiry",
		
		setSessionEpiry: function(expiry) {
			 return servletBase_ + "setsessionexpiry&expiry=" + expiry;
		},
		
		filelist: servletBase_ + "filelist",
		
		openfile: function(filename) {
			return servletBase_ + "openfile&filename="+filename;
		},
		
		menubar: servletBase_ + "menuDef&menuClass=MenuBar",
		
		modeltree: function(tab) {
			var uri = servletBase_ + "modelTree";
			if(tab !== undefined && tab !== null) {
				uri+="&currentTab="+tab;
			}
			return uri;
		},
		
		setTreeNode: function(modelId,otherArgs,nodeType) {
			var args = "";
			if(otherArgs) {
				for(var i in otherArgs) {
					if(otherArgs.hasOwnProperty(i)) {
						args += "&"+i+"="+otherArgs[i];
					}
				}
			}
			return servletBase_ + "command&cmdClass=OTHER&cmdKey=" + nodeType.toUpperCase() + "_SELECTION&nodeID=" + modelId + args;
		},
		
		expData: BASE_LOCATION + "expdata/",
		
		pathing: BASE_LOCATION + "pathing/",
		
		getModel: servletBase_ + "getModel",
		
		toolbar: servletBase_ + "menuDef&menuClass=ToolBar",
		
		modelImage: function(modelId) {
			return servletBase_ + "modelImage" 
				+ (modelId ? "&modelID="+modelId : "");
		},
		
		nodeJson: function(nodeId,tab,nodeType) {
			var uri = servletBase_ + "nodeJson";
			if(nodeId) {
				uri+="&nodeID="+nodeId;
			}
			if(tab !== undefined && tab !== null) {
				uri+="&currentTab="+tab;
			}
			if(nodeType) {
				uri+="&nodeType="+nodeType;
			}
			return uri;
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
		popup: function(nodeType,hit,clientstate,tab) {
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
			+ (clientstate ? "&clientstate=true" : "")
			+ (tab !== null && tab !== undefined ? "&currentTab="+tab : "");
		},
		
		modelTreeContext: function(modelId) {
			return servletBase_ + "menuDef&menuClass=ModelTreeMenu&popObjID=" + modelId;
		},
		
		tabContext: function() {
			return servletBase_ + "menuDef&menuClass=TabMenu";
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