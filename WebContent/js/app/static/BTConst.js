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

////////////////////////////////////
// BTConst
/////////////////////////////////////
//
// Static file for const values

define([],function(){
	
	
	return {
		// container IDs
		TAB_CONTAINER_ID: "tab_container",
		APP_CONTAINER_ID: "app_container",
		CANVAS_CONTAINER_NODE_ID_BASE: "grn",
		CANVAS_WRAPPER_NODE_ID_BASE: "grnWrapper",		
		TOP_PANE_ID: "top_pane",
		HEADER_PANE_ID: "header_pane",
		FOOTER_WRAPPER_ID: "footer_wrapper",
		FOOTER_PANE_ID: "footer_pane",
		SELEX_BOX_ID: "selexBox",
		TAB_BC_ID_BASE: "tab_border_container_",
		
		// Result responses
		RESULT_SESSION_READY: "SESSION_READY",
		RESULT_NEW_SESSION: "NEW_SESSION",
		
		// Menu item subclasses
		M_ACT: "ACTION",
		M_CUST_ACT: "CUSTOM_ACTION",
		M_SEP: "SEPARATOR",
		M_MENU: "MENU",
		M_MENU_PLACE: "MENU_PLACEHOLDER",
		M_CHECK_ACT: "CHECKBOX_ACTION",
		M_CHECK_TOGG: "TOGGLE",
		
		// Model Tree Node types
		NODETYPE_GROUP: "GROUP_NODE",
		NODETYPE_MODEL: "MODEL",
		
		// Hit type map
		HIT_TO_NODE_TYPE: {
			"gene":"GENE",
			"linkage":"LINK",
			"tablet":"NODE",
			"intercell":"NODE",
			"slash":"NODE",
			"box":"NODE",
			"bare":"NODE",
			" ":"LINK_POINT", 
			"note": "NOTE", 
			"group": "REGION", 
			" ": "OVERLAY", 
			"net_module": "MODULE", 
			" ": "MODULE_LINK", 
			" ": "MODULE_LINK_POINT"
		},
		
		// Timeouts
		NODE_JSON_TIMEOUT: 120000,
		VIEWER_CMD_TIMEOUT: 120000,
		EDITOR_CMD_TIMEOUT: 120000,
		
		// Client Modes
		CLIENTMODE_EDITOR: "EDITOR",
		CLIENTMODE_VIEWER: "VIEWER"
	};
	
});