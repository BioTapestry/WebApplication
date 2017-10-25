/*
**    Copyright (C) 2003-2016 Institute for Systems Biology 
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
    "dojo/text!./build.info"
    ,"dojo/text!./viewerKeymapModel.html"
    ,"dojo/text!./viewerKeymapMenu.html"
    ,"dojo/text!./viewerKeymapModelTree.html"
    ,"dojo/text!./editorKeymapModel.html"
    ,"dojo/text!./editorKeymapMenu.html"
    ,"dojo/text!./editorKeymapModelTree.html"
    ,"dojo/text!./about.html"
    ,"dojo/text!./zoomWarn.html"
],function(
	buildText
	,keymapViewerModel
	,keymapViewerMenu
	,keymapViewerModelTree
	,keymapEditorModel
	,keymapEditorMenu
	,keymapEditorModelTree
	,about
	,zoomWarnText
){
	
	//////////////////
	// TextMessages
	//////////////////
	//
	// Module containing static text messages to be used on static pages or in dialogs,
	// plus functions to allow for updating specific fields
	
	var buildInfo = JSON.parse(buildText);
	
	return {
		aboutViewer: about.replace(/\{TYPE\}/g,"Viewer")
			.replace(/\{BTWVERSION\}/g,buildInfo.BTWVERSION)
			.replace(/\{BTVERSION\}/g,buildInfo.BTVERSION)
			.replace(/\{BUILDDATE\}/g,buildInfo.DATE)
			.replace(/\{YEAR\}/g,new Date().getFullYear())
		,aboutEditor: about.replace(/\{TYPE\}/g,"Editor")
			.replace(/\{BTWVERSION\}/g,buildInfo.BTWVERSION)
			.replace(/\{BTVERSION\}/g,buildInfo.BTVERSION)
			.replace(/\{BUILDDATE\}/g,buildInfo.DATE)
			.replace(/\{YEAR\}/g,new Date().getFullYear())
		,keyMapViewer: {
			modelTabTitle: "Model Display"
			,menuTabTitle: "Toolbar"
			,modelTreeTabTitle: "Model Tree"
			,modelTabContent: keymapViewerModel
			,menuTabContent: keymapViewerMenu
			,modelTreeTabContent: keymapViewerModelTree
		}
		,keyMapEditor: {
			modelTabTitle: "Model Display"
			,menuTabTitle: "File Menu and Toolbar"
			,modelTreeTabTitle: "Model Tree"
			,modelTabContent: keymapEditorModel
			,menuTabContent: keymapEditorMenu
			,modelTreeTabContent: keymapEditorModelTree
		}
		,zoomWarning: function(type) {
			return zoomWarnText.replace(/\{ZOOMTYPE\}/g,type);
		}
		,V_SLOW_LOAD: "The model appears to be loading very slowly.<br />You may wish to reload the application or check your internet connection."
		,BAD_CLICK: "That was not a valid click location! Please try again."
		,GENERIC_ERROR: "There was an error while processing this request."
	};
});