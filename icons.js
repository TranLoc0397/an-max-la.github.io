/* Shared SVG icon set (stroke icons, inherit currentColor). */
(function(root){
 const P={
"plus": "<path d=\"M12 5v14M5 12h14\"/>",
"arrow-right": "<path d=\"M5 12h14M13 6l6 6-6 6\"/>",
"share": "<circle cx=\"18\" cy=\"5\" r=\"3\"/><circle cx=\"6\" cy=\"12\" r=\"3\"/><circle cx=\"18\" cy=\"19\" r=\"3\"/><path d=\"M8.6 13.5l6.8 4M15.4 6.5l-6.8 4\"/>",
"link": "<path d=\"M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7\"/><path d=\"M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7\"/>",
"shield": "<path d=\"M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z\"/><path d=\"M9 12l2 2 4-4\"/>",
"luggage": "<rect x=\"5\" y=\"7\" width=\"14\" height=\"13\" rx=\"2\"/><path d=\"M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7M9 11v5M15 11v5M8 20v1M16 20v1\"/>",
"sparkles": "<path d=\"M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z\"/><path d=\"M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z\"/>",
"scale": "<path d=\"M12 4v17M8 21h8M4 7h16\"/><path d=\"M7 7l-3 7a3 3 0 0 0 6 0z\"/><path d=\"M17 7l-3 7a3 3 0 0 0 6 0z\"/>",
"coins": "<circle cx=\"9\" cy=\"9\" r=\"6\"/><path d=\"M15.5 9.3a6 6 0 1 1-6.2 6.2\"/>",
"arrow-left-right": "<path d=\"M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4\"/>",
"lightbulb": "<path d=\"M9 18h6M10 21h4\"/><path d=\"M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z\"/>",
"history": "<path d=\"M3 12a9 9 0 1 0 3-6.7L3 8\"/><path d=\"M3 3v5h5\"/><path d=\"M12 7v5l3 2\"/>",
"clipboard": "<rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\"/><path d=\"M9 4V3h6v1M9 10h6M9 14h6M9 18h3\"/>",
"user-circle": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/><path d=\"M6.2 18.4a6.5 6.5 0 0 1 11.6 0\"/>",
"plane": "<path d=\"M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z\"/>",
"mountain": "<path d=\"M3 20l6-11 4 7 2-3 6 7z\"/>",
"map": "<path d=\"M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z\"/><path d=\"M9 4v14M15 6v14\"/>",
"compass": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M15.5 8.5l-2 5-5 2 2-5z\"/>",
"crown": "<path d=\"M3 8l4 4 5-7 5 7 4-4-2 11H5z\"/>",
"check": "<path d=\"M5 12l5 5 9-10\"/>",
"calendar": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2\"/><path d=\"M8 3v4M16 3v4M3 10h18\"/>",
"mail": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"14\" rx=\"2\"/><path d=\"M3 7l9 6 9-6\"/>",
"utensils": "<path d=\"M4 3v7a3 3 0 0 0 6 0V3M7 3v18M17 21V3c-2 1-3.5 3.5-3.5 7s1.5 4 3.5 4\"/>",
"car": "<path d=\"M5 17h14v-5l-2-5H7l-2 5z\"/><path d=\"M5 12h14\"/><circle cx=\"8\" cy=\"17\" r=\"2\"/><circle cx=\"16\" cy=\"17\" r=\"2\"/>",
"home": "<path d=\"M3 11l9-8 9 8\"/><path d=\"M5 10v10h14V10\"/><path d=\"M10 20v-6h4v6\"/>",
"ticket": "<path d=\"M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z\"/><path d=\"M14 7v2M14 11v2M14 15v2\"/>",
"bag": "<path d=\"M5 7h14l-1 14H6z\"/><path d=\"M9 10V6a3 3 0 0 1 6 0v4\"/>",
"receipt": "<path d=\"M5 3h14v18l-2.5-1.5L14 21l-2-1.5L10 21l-2.5-1.5L5 21z\"/><path d=\"M9 8h6M9 12h6M9 16h3\"/>",
"dashboard": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"9\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"5\" rx=\"1.5\"/><rect x=\"14\" y=\"12\" width=\"7\" height=\"9\" rx=\"1.5\"/><rect x=\"3\" y=\"16\" width=\"7\" height=\"5\" rx=\"1.5\"/>",
"wallet": "<path d=\"M19 7V5.5A1.5 1.5 0 0 0 17.5 4H5a2 2 0 0 0 0 4h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6\"/><path d=\"M16.5 14h.01\"/>",
"users": "<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20a6.5 6.5 0 0 1 13 0\"/><path d=\"M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6\"/>",
"more": "<circle cx=\"5\" cy=\"12\" r=\"1.4\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\"1.4\" fill=\"currentColor\"/><circle cx=\"19\" cy=\"12\" r=\"1.4\" fill=\"currentColor\"/>"
};
 function icon(name,cls){return '<svg class="tt-icon'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'+(P[name]||'')+'</svg>'}
 root.TTIcon=icon;
 if(typeof module==='object'&&module.exports)module.exports={icon,paths:P};
})(globalThis);
