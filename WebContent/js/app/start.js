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

/**
 * Identify the locations of all of our libraries, and give them
 * short-hands for use in require/define. If a library's location
 * isn't listed here it won't be available.
 * 
 * You can also do this in your index.html as a dojo-config.
 * 
 * 
 * 
 * 
 */

require({
	baseUrl: 'js/',
	tlmSiblingOfDojo: false,
	packages: [
       	/* Dojo Libraries */
       { name: "dojo", location: "lib/dojo"},
       { name: "dijit", location: "lib/dijit"},
       /* Dgrid libraries */
       { name: "dgrid", location: "lib/dgrid"},
       { name: "xstyle", location: "lib/xstyle"},
       { name: "put-selector", location: "lib/put-selector"},
       /* Our libraries and app */
       { name: "static", location: "app/static"},
       { name: "dialogs", location: "app/ui/dialogs"},
       { name: "widgets", location: "app/ui/widgets"},
       { name: "ui", location: "app/ui"},
       { name: "views", location: "app/views"},
       { name: "models", location: "app/models"},
       { name: "controllers", location: "app/controllers"},
       { name: "app", location: "app" },
       { name: "utils", location: "lib/utils"}
	]
},['app']);