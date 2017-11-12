
define(['d3', 'd3-geo', 'metr/io', 'metr/utils', 'sprintf'], function(d3, d3geo, io, utils, sprintf) {
    var _mod = this;
    var sprintf = sprintf.sprintf;

    var gui = function() {
        var _this = this;

        this._popup_menu = {
            /* Come up with a better way to add the '>' than add a crap-ton of nbsp's ... */
            'Geography&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;>': {
                'US States': {
                    'action': function() { _this.add_layer(0, ShapeLayer, 'geo', 'us_cty'); },
                    'available':false,
                },
                'US Counties': {
                    'action': function() { _this.add_layer(0, ShapeLayer, 'geo', 'us_st'); },
                    'available':false,
                },
                'US Interstate Highways': {
                    'action': function() { _this.add_layer(0, ShapeLayer, 'geo', 'us_interstate'); },
                    'available':true,
                },

            },
            'Level 2 Radar': {
                'action': function() { console.log("Adding Level2 layer"); },
                'available': true,
            },
            'Observations&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;>': {
                'METAR': {
                    'action':function() { _this.add_layer(0, ObsLayer, 'metar'); },
                    'available': true,
                },
                'Mesonet': {
                    'action': function() { _this.add_layer(0, ObsLayer, 'mesonet'); },
                    'available': true,
                },
            },
        };

        this.draw_order = [];

        this.init_map = function() {
            _this.map = d3.select('#main');
            _this.map.node().width = window.innerWidth;
            _this.map.node().height = window.innerHeight;
            _this.map.style('background-color', '#cccccc');

            _this.width = _this.map.node().width
            _this.height = _this.map.node().height
            _this.init_width = _this.width;
            _this.init_height = _this.height;

            _this._menu_bar_width = '175px';
            _this._stat_hgt = 25
            _this.status = d3.select('#status');
            _this.status.style('height', _this._stat_hgt).style('top', _this.height - _this._stat_hgt)

            _this.menu = d3.select('#menu');
            _this.menu.style('height', _this.height - _this._stat_hgt)
            _this.menu_tabs = d3.select('#menutabs');
            _this.menu_tabs.selectAll('li').on('click', function() { _this.toggle_menu(this); });
            _this.menu_visible = "";
            _this._active_layer = undefined;

            _this.trans_x = 0;
            _this.trans_y = 0;
            _this.set_zoom(d3.zoomTransform(_this.map.node()));

            var parallels = [30, 45];
            var std_lon = -97.5;
            var std_lat = 37.5;

            _this.map_proj = d3geo.geoConicConformal()
                                  .parallels(parallels)
                                  .rotate([-std_lon, 0])
                                  .center([0, std_lat])
                                  .scale(1000)
                                  .translate([0, 0]);

            var gl = _this.map.node().getContext('webgl');

            _this.add_layer(0, ShapeLayer, 'geo', 'us_cty');
            _this.add_layer(0, ShapeLayer, 'geo', 'us_st');
            _this.add_layer(-1, Level2Layer, 'KTLX', 'REF', 0.5);

            d3.json('trebuchet.atlas', function(atlas) {
                var texture_data = atlas.texture;
                atlas.texture = new Image();
                atlas.texture.onload = function(event) {
                    _mod.font_atlas = new FontAtlas(atlas);
                }
                atlas.texture.src = 'data:image/png;base64,' + texture_data;
            });

            window.addEventListener('resize', function() {
                _this.map.node().width = window.innerWidth;
                _this.map.node().height = window.innerHeight;
                var old_width = _this.width;
                var old_height = _this.height;
                _this.width = _this.map.node().width
                _this.height = _this.map.node().height

                _this.status.style('top', _this.height - _this._stat_hgt).style('height', _this.stat_hgt);
                _this.menu.style('height', _this.height - _this._stat_hgt)
/*
                var old_full_width = (old_width * _this.zoom_trans.k);
                var new_full_width = (_this.width * _this.zoom_trans.k);
                var old_full_height = (old_height * _this.zoom_trans.k);
                var new_full_height = (_this.height * _this.zoom_trans.k);

                var new_x = new_full_width * _this.zoom_trans.x / old_full_width;
                var new_y = new_full_height * _this.zoom_trans.y / old_full_height;
                _this.trans_x = (new_x - _this.zoom_trans.x) / _this.zoom_trans.k 
                _this.trans_y = (new_y - _this.zoom_trans.y) / _this.zoom_trans.k
*/

                _this.trans_x = -(_this.width - _this.init_width) / 2;
                _this.trans_y = -(_this.height - _this.init_height) / 2;

                _this.set_zoom(d3.zoomTransform(_this.map.node()));
                for (ilyr in _this.draw_order) {
                    _this.draw_order[ilyr].set_viewport(_this.width, _this.height);
                }
                _this.draw();
            });

            var trans = d3.zoomIdentity
            if (utils.get_cookie('zoom_k') !== undefined) {
                var zoom_k = utils.get_cookie('zoom_k');
                var zoom_x = utils.get_cookie('zoom_x');
                var zoom_y = utils.get_cookie('zoom_y');

                trans = trans.translate(zoom_x, zoom_y).scale(zoom_k);
            }

            var zoom = d3.zoom().scaleExtent([0.5, 240]).on("zoom", _this.zoom)
            _this.map.call(zoom).call(zoom.transform, trans);

        };

        this.zoom = function() {
            utils.set_cookie('zoom_k', d3.event.transform.k.toString());
            utils.set_cookie('zoom_x', d3.event.transform.x.toString());
            utils.set_cookie('zoom_y', d3.event.transform.y.toString());

            _this.set_zoom(d3.event.transform);
            _this.draw();
        };

        this.set_zoom = function(base_trans) {
            _this.zoom_trans = base_trans.translate(_this.width / 2 + _this.trans_x, _this.height / 2 + _this.trans_y);
        }

        this.draw = function() {
            var gl = _this.map.node().getContext('webgl');
            gl.viewport(0, 0, _this.width, _this.height);
            gl.clearColor(0.8, 0.8, 0.8, 1.0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            kx = _this.zoom_trans.k / _this.width;
            ky = _this.zoom_trans.k / _this.height;
            tx = (_this.zoom_trans.x - _this.width / 2) / _this.zoom_trans.k;
            ty = (_this.zoom_trans.y - _this.height / 2) / _this.zoom_trans.k;
            zoom_matrix = [kx, 0, kx * tx, 0, -ky, -ky * ty, 0, 0, 1]

            for (ilyr in _this.draw_order) {
                _this.draw_order[ilyr].draw(zoom_matrix, _this.zoom_trans.k);
            }
        };

        this.add_layer = function(pos, LayerType) {
            var args = Array.prototype.slice.call(arguments, 2);
            var gl = _this.map.node().getContext('webgl');
            args.splice(0, 0, gl);

            var lyr = Object.create(LayerType.prototype);
            LayerType.apply(lyr, args);

            lyr.set_map_projection(_this.map_proj);
            lyr.set_viewport(_this.width, _this.height);
            lyr.register_callback('redraw', _this.draw);
            lyr.register_callback('status', _this.set_status);
            lyr.active = false;

            if (pos == -1) {
                _this.draw_order.unshift(lyr);
            }
            else {
                _this.draw_order.push(lyr);
            }

            _this.activate_layer(lyr);
        };

        this.remove_layer = function(lyr) {
            var lyr_idx = _this.draw_order.indexOf(lyr);
            if (lyr_idx === -1) {
                throw "Item doesn't exist to remove"
            }

            _this.draw_order.splice(lyr_idx, 1);

            if (lyr.active) {
                var new_idx = Math.max(lyr_idx - 1, 0);
                _this.activate_layer(_this.draw_order[new_idx]);
            }

            if (_this.menu_visible.innerHTML == 'Layers') {
                _this.show_menu['Layers']();
            }
        };

        this.set_status = function(stat_txt) {
            var elem = _this.status.select('p');
            elem.text(stat_txt);
            var hgt = (_this._stat_hgt - elem.node().getBoundingClientRect().height) / 2;
            elem.style('margin-top', hgt).style('margin-bottom', hgt);
        };

        this.toggle_menu = function(menu_item) {
            var unselected = "rgba(0, 0, 0, 0.6)";
            var selected = "rgba(77, 77, 77, 0.6)";
            var menu_name = menu_item.innerHTML;
            if (_this.menu_visible == menu_item) {
                _this.menu.node().style.background = unselected;
                menu_item.style.background = unselected;
                _this.toggle_menu_bar();

                _this.menu_visible = "";
            }
            else {
                if (_this.menu_visible != "") {
                    _this.menu_visible.style.background = unselected;
                }
                _this.menu.node().style.background = selected;
                menu_item.style.background = selected;

                if (_this.menu_visible == "") {
                    _this.toggle_menu_bar();
                }

                try {
                    _this.show_menu[menu_item.innerHTML]();
                }
                catch (err) {
                    _this.show_menu['default']();
                }
                _this.menu_visible = menu_item;
            }
        };

        this.show_menu = {
            'Layers': function() {
                _this.menu.html("");
                var ul = _this.menu.append('ul');
                for (var ilyr = _this.draw_order.length - 1; ilyr > -1; ilyr--) {
                    var lyr_html = _this.draw_order[ilyr].layer_menu_html();
                    var lyr_mkr = ul.append('li').on('click', function() {
                        var n_layers = _this.draw_order.length;
                        var lyr_index;
                        for (var lyr of this.parentNode.childNodes.entries()) {
                            if (lyr[1] == this) {
                                lyr_index = lyr[0];
                            }
                        }
                        _this.activate_layer(_this.draw_order[n_layers - lyr_index - 1]);
                    });
                    lyr_mkr.append('div').attr('class', 'drag').text("\u22ee");
                    lyr_mkr.append('p').html(lyr_html);
                    lyr_mkr.append('div')
                           .attr('class', 'remove')
                           .text('\u00d7')
                           .on('click', function() {
                               var n_layers = _this.draw_order.length;
                               var lyr_index;
                               for (var lyr of this.parentNode.parentNode.childNodes.entries()) {
                                   if (lyr[1] == this.parentNode) {
                                       lyr_index = lyr[0];
                                   }
                               }
                               _this.remove_layer(_this.draw_order[n_layers - lyr_index - 1]);
                               _this.draw();
                               d3.event.stopPropagation();
                           });

                    if (_this.draw_order[ilyr].active) {
                        var n_layers = _this.draw_order.length;
                        var lyr_marker = d3.select(ul.node().childNodes[n_layers - ilyr - 1]);
                        lyr_marker.attr('class', 'active');
                    }
                }

                var width = parseInt(_this._menu_bar_width, 10) - 4;
                ul.selectAll('li').style('width', width + 'px');
                ul.selectAll('li').call(d3.drag().on('start', _this._drag_layers));

                ul.append('li').html('+').attr('class', 'addnew').on('click', function() {
                    var root = d3.select(this).attr('depth', 0)
                    root.node().options = _this._popup_menu;
                    _this._add_menu(root); 
                });
            },
            'About': function() {
                _this.menu.html("");
                _this.menu.append('div').html('<h1>METR</h1>&copy; 2017 Tim Supinie');
            },
            'default': function() {
                _this.menu.html("");
            }
        };

        this.toggle_menu_bar = function() {
            var trans = d3.transition().duration(500);
            if (_this.menu_visible == "") {
                _this.menu.style('width', _this._menu_bar_width).style('left', '-' + _this._menu_bar_width);
                _this.menu.transition(trans).style('left', '0px');
                _this.menu_tabs.transition(trans).style('left', _this._menu_bar_width);
            }
            else {
                _this.menu.transition(trans).style('left', '-' + _this._menu_bar_width);
                _this.menu_tabs.transition(trans).style('left', '0px');
            }
        };

        this._drag_layers = function() {
            if (d3.event.sourceEvent.path[0].classList.value !== "drag") {
                return;
            }

            var lyr_marker = d3.select(this);
            var lyr_parent = d3.select(this.parentNode);

            var lyr_index;
            var lyr_coords = [];
            for (var lyr of this.parentNode.childNodes.entries()) {
                var lyr_rect = lyr[1].getBoundingClientRect();
                if (lyr[1].className != "addnew") {
                    lyr_coords[lyr[0]] = (lyr_rect.top + lyr_rect.bottom) / 2;
                }
                if (lyr[1] == this) {
                    lyr_index = lyr[0];
                }
            }

            var lyr_spacer = d3.select(this.cloneNode(false)).style('visibility', 'hidden').node();
            this.parentNode.insertBefore(lyr_spacer, this.parentNode.childNodes[lyr_index + 1]);

            var mkr_pos = this.getBoundingClientRect();
            if (lyr_marker.attr('class') == 'active') {
                var pad_left = 0;
                var pad_top = -2;
            }
            else {
                var pad_left = 2;
                var pad_top = 2;
            }
            var dx = d3.event.x - mkr_pos.left + pad_left;
            var dy = d3.event.y - mkr_pos.top + pad_top;

            lyr_marker.style('position', 'absolute').style('left', mkr_pos.left - pad_left).style('top', mkr_pos.top - pad_top);

            function dragged(d) {
                lyr_marker.style('left', d3.event.x - dx).style('top', d3.event.y - dy);
                var mkr_pos = this.getBoundingClientRect();
                if (lyr_index > 0 && mkr_pos.top < lyr_coords[lyr_index - 1]) {
                    var swap_node = this.parentNode.childNodes[lyr_index - 1];
                    this.parentNode.removeChild(swap_node);
                    this.parentNode.insertBefore(swap_node, this.parentNode.childNodes[lyr_index + 1]);

                    var n_layers = _this.draw_order.length;
                    var swap_lyr = _this.draw_order[n_layers - (lyr_index - 1) - 1];
                    _this.draw_order.splice(n_layers - (lyr_index - 1) - 1, 1);
                    _this.draw_order.splice(n_layers - lyr_index - 1, 0, swap_lyr);
                    _this.draw()

                    lyr_index--;
                }
                else if (lyr_index < lyr_coords.length - 1 && mkr_pos.bottom > lyr_coords[lyr_index + 1]) {
                    var swap_node = this.parentNode.childNodes[lyr_index + 2];
                    this.parentNode.removeChild(swap_node);
                    this.parentNode.insertBefore(swap_node, this.parentNode.childNodes[lyr_index]);

                    var n_layers = _this.draw_order.length;
                    var swap_lyr = _this.draw_order[n_layers - (lyr_index + 1) - 1];
                    _this.draw_order.splice(n_layers - (lyr_index + 1) - 1, 1);
                    _this.draw_order.splice(n_layers - (lyr_index) - 1, 0, swap_lyr);
                    _this.draw()

                    lyr_index++;
                }
            }

            function dragend() {
                this.parentNode.removeChild(lyr_spacer);
                lyr_marker.style('position', 'static');
            }

            d3.event.on('drag', dragged).on('end', dragend);
        };

        this.activate_layer = function(layer) {
            if (_this._active_layer !== undefined) {
                _this._active_layer.active = false;
            }

            layer.active = true;
            _this._active_layer = layer;

            if (_this.menu_visible.innerHTML == 'Layers') {
                _this.show_menu['Layers']();
            }

            _this.set_status(layer.get_status());
        };

        this._add_menu = function(root) {
            var root_rect = root.node().getBoundingClientRect();

            var width = parseInt(_this._menu_bar_width, 10);
            menu_root = d3.select('#menu').append('ul')
                                          .attr('id', 'popup' + root.attr('depth'))
                                          .style('position', 'absolute')
                                          .style('left', root_rect.left + width - 3)
                                          .style('top', root_rect.top - 2 + root_rect.height / 3)
                                          .style('width', root_rect.width)
                                          .style('height', root_rect.height)
                                          .style('margin-top', 0);
            menu_root.node().menu_parent = root;

            function remove_menu(depth) {
                var sub_menu = d3.select('#menu #popup' + depth);
                while (!sub_menu.empty()) {
                    var sub_menu_root = sub_menu.node().menu_parent;
                    sub_menu.remove();

                    if (sub_menu_root !== undefined) {
                        if (depth == 0) {
                            sub_menu_root.on('click', function() { _this._add_menu(d3.select(this)); });
                        }
                        else {
                            sub_menu_root.on('click', add_submenu);
                        }
                    }

                    depth++;
                    sub_menu = d3.select('#menu #popup' + depth);
                }
            }

            function add_submenu() {
                var li = d3.select(this);
                var submenu = li.node().options;
                if ('action' in submenu) {
                    // Leaf node (run the menu action)
                    if (submenu['available']) {
                        submenu['action']();
                        remove_menu(0);
                        submenu['available'] = false;
                    }
                }
                else {
                    // Actual submenu (show the submenu)
                    remove_menu(li.attr('depth'));
                    _this._add_menu(li); 
                }
            }

            for (var opt in root.node().options) {
                menu_root.append('li')
                         .style('height', '24px')
                         .style('padding-top', '6px')
                         .style('cursor', 'pointer')
                         .html(opt)
                         .attr('depth', parseInt(root.attr('depth')) + 1)
                         .node().options = root.node().options[opt];
            }

            menu_root.selectAll('li').on('click', add_submenu);

            root.on('click', function() {
                var item = d3.select(this);
                var item_depth = item.attr('depth');
                remove_menu(item_depth);
            });
        };
    };

    this.DataLayer = function(gl) {
        this._gl = gl;
        this._callbacks = {};
    };

    this.DataLayer.prototype.set_map_projection = function(map_proj){
        this.map_proj = map_proj;
    };
 
    this.DataLayer.prototype.register_callback = function(action, cb) {
        this._callbacks[action] = cb;
    };

    this.DataLayer.prototype.draw = function(zoom_matrix, zoom_fac) {

    };

    this.DataLayer.prototype.layer_menu_html = function() {
        return "";
    };

    this.DataLayer.prototype.set_viewport = function(width, height) {
        this._vp_width = width;
        this._vp_height = height;
    };

   /********************
    * ShapeLayer code
    ********************/
    this.ShapeLayer = function(gl, cls, name) {
        var _vert_shader_src = `
            attribute vec2 a_pos;
            uniform vec2 u_delta;
            uniform mat3 u_zoom;

            void main() {
                vec2 zoom_pos = (vec3(a_pos + u_delta, 1.0) * u_zoom).xy;
                gl_Position = vec4(zoom_pos * 2.0, 0.0, 1.0);
            }
        `;

        var _frag_shader_src = `
            precision mediump float;
            uniform vec3 u_color;

            void main() {
                gl_FragColor = vec4(u_color, 1.0);
            }
        `;

        this._gl = gl;
        this.cls = cls;
        this.name = name;

        this._callbacks = {};

        this._shader_prog = _mod.compile_shaders(gl, _vert_shader_src, _frag_shader_src);
        this._pos = gl.getAttribLocation(this._shader_prog, 'a_pos');
        this._posbuf = gl.createBuffer();
        this._zoom = gl.getUniformLocation(this._shader_prog, 'u_zoom');
        this._delta = gl.getUniformLocation(this._shader_prog, 'u_delta');
        this._linecolor = gl.getUniformLocation(this._shader_prog, 'u_color');

        if (name == 'us_st') {
            this.set_linewidth(2);
            this._color = [0, 0, 0];
        }
        else if ( name == 'us_interstate') {
            this.set_linewidth(2);
            this._color = [0, 0, 0.4];
        }
        else {
            this.set_linewidth(1);
            this._color = [0, 0, 0];
        }

        this._proj_data = [];
        var tag = sprintf('shapefile.%s.%s', cls, name);
        io.register_handler(tag, this.receive_data.bind(this));
        io.request({'type':'shapefile', 'domain':cls, 'name':name});
    };

    this.ShapeLayer.prototype = Object.create(this.DataLayer.prototype);
    this.ShapeLayer.prototype.constructor = this.ShapeLayer;

    this.ShapeLayer.prototype.receive_data = function(shp_file) {
        if (shp_file.error !== undefined) {
            console.log('Server error: ' + shp_file.error);
            return;
        }

        this._proj_data = [];
        var ipp = 0;
        for (var ipt = 0; ipt < shp_file.data.length; ipt++) {
            if (isNaN(shp_file.data[ipt])) {
                this._proj_data[ipp] = NaN;
                this._proj_data[ipp + 1] = NaN;
            }
            else {
                var raw_pt = [shp_file.data[ipt], shp_file.data[ipt + 1]];
                var proj_pt = this.map_proj(raw_pt);
                this._proj_data[ipp] = proj_pt[0];
                this._proj_data[ipp + 1] = proj_pt[1];
                ipt++;
            }
            ipp += 2;
        }
        this._callbacks['redraw']();
    };

    this.ShapeLayer.prototype.get_status = function() {
        var names = {'us_cty': 'US County Boundaries', 'us_st': 'US State Boundaries', 'us_interstate':'US Interstate Highways'};
        return names[this.name];
    }

    this.ShapeLayer.prototype.draw = function(zoom_matrix, zoom_fac) {
        if (this._proj_data == []) {
            return;
        }

        var gl = this._gl;
        gl.useProgram(this._shader_prog);
        gl.enableVertexAttribArray(this._pos);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._posbuf);
        gl.vertexAttribPointer(this._pos, 2, gl.FLOAT, false, 0, 0);
        gl.uniformMatrix3fv(this._zoom, false, zoom_matrix);
        gl.uniform3f(this._linecolor, this._color[0], this._color[1], this._color[2]);

        for (ivec in this._delta_vectors) {
            vec = this._delta_vectors[ivec];

            gl.uniform2f(this._delta, vec[0] / zoom_fac, vec[1] / zoom_fac); 
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._proj_data), gl.DYNAMIC_DRAW);
            gl.drawArrays(gl.LINE_STRIP, 0, this._proj_data.length / 2);
        }
    };

    this.ShapeLayer.prototype.layer_menu_html = function() {
        var names = {'us_cty':'US Counties', 'us_st':'US States', 'us_interstate':'US Interstate Highways'};
        var readable_name = names[this.name];
        return readable_name;
    };

    this.ShapeLayer.prototype.set_linewidth = function(linewidth) {
        this.linewidth = linewidth;
        this._delta_vectors = this._compute_delta_vectors(this.linewidth);
    };

    this.ShapeLayer.prototype._compute_delta_vectors = function(linewidth) {
        /* This will not be general. In the future, will probably have to actually do poly-lines. */
        var vecs;
        if (linewidth == 1) {
            vecs = [[0, 0]];
        }
        else if (linewidth == 2) {
            vecs = [[0.5, 0.5], [0.5, -0.5], [-0.5, -0.5], [0.5, -0.5]];
        }
        return vecs
    };

   /********************
    * Level2Layer code
    ********************/
    this.Level2Layer = function(gl, site, field, elev) {
        var _vert_shader_src = `
            attribute vec2 a_pos;
            attribute vec2 a_tex;
            uniform mat3 u_zoom;
            uniform vec2 u_rdr_pos;

            varying vec2 v_tex;

            void main() {
                vec2 pos_px = u_rdr_pos + vec2(a_pos.x * cos(a_pos.y), a_pos.x * sin(a_pos.y));
                vec2 zoom_pos = (vec3(pos_px, 1.0) * u_zoom).xy;
                gl_Position = vec4(zoom_pos * 2.0, 0.0, 1.0);
                v_tex = a_tex;
            }
        `;

        var _frag_shader_src = `
            precision mediump float;

            varying vec2 v_tex;
            uniform sampler2D u_tex;

            void main() {
                vec4 color = texture2D(u_tex, v_tex);
                if (color.a < 0.5)
                    discard;
                gl_FragColor = color;
            }
        `;

        this._gl = gl;
        this._callbacks = {};

        this.site = site;
        this.field = field;
        this.elev = elev;

        this._shader_prog = _mod.compile_shaders(gl, _vert_shader_src, _frag_shader_src);

        this._pos = gl.getAttribLocation(this._shader_prog, 'a_pos');
        this._posbuf = gl.createBuffer();
        this._texc = gl.getAttribLocation(this._shader_prog, 'a_tex');
        this._texcbuf = gl.createBuffer();
        this._tex = gl.getUniformLocation(this._shader_prog, 'u_tex');
        this._zoom = gl.getUniformLocation(this._shader_prog, 'u_zoom');
        this._rdr = gl.getUniformLocation(this._shader_prog, 'u_rdr_pos');

        var int_deg = Math.floor(elev);
        var frc_deg = Math.round((elev - int_deg) * 10);
        var tag = sprintf("level2radar.%s.%s.%02dp%1d", site, field, int_deg, frc_deg);
        io.register_handler(tag, this.receive_data.bind(this));
        io.request({'type':'level2radar', 'site':site, 'field':field, 'elev':elev});
    };

    this.Level2Layer.prototype = Object.create(this.DataLayer.prototype);
    this.Level2Layer.prototype.constructor = this.Level2Layer;

    this.Level2Layer.prototype.receive_data = function(l2_file) {
        if (l2_file.error !== undefined) {
            console.log('Server error: ' + l2_file.error);
            return;
        }

        this._l2_file = l2_file
        this._rdr_loc = this.map_proj([l2_file.site_longitude, l2_file.site_latitude]);
        var start_loc = this.map_proj([l2_file.first_longitude, l2_file.first_latitude]);

        var rdr_px = this._rdr_loc;
        var start_px = start_loc;

        var st_rn = Math.sqrt((start_px[0] - rdr_px[0]) ** 2 + (start_px[1] - rdr_px[1]) ** 2);
        var st_az = Math.atan2(start_px[1] - rdr_px[1], start_px[0] - rdr_px[0]) * 180 / Math.PI;
        var drng = l2_file.drng * st_rn / l2_file.st_range;
        var dazim = l2_file.dazim;
        var tex_size_x = l2_file.n_gates;
        var tex_size_y = l2_file.n_rays;

        var ipt = 0;
        this._pts = [];
        this._tex_coords = [];
        for (var iaz = 0; iaz < l2_file.n_rays + 1; iaz++) {
            this._pts[ipt + 0] = (st_rn + (l2_file.n_gates + 0.5) * drng);
            this._pts[ipt + 1] = (st_az + (iaz - 0.5) * dazim) * Math.PI / 180.;
            this._pts[ipt + 2] = (st_rn - 0.5 * drng);
            this._pts[ipt + 3] = (st_az + (iaz - 0.5) * dazim) * Math.PI / 180.;

            this._tex_coords[ipt + 0] = l2_file.n_gates / tex_size_x;
            this._tex_coords[ipt + 1] = iaz / tex_size_y;
            this._tex_coords[ipt + 2] = 0.0;
            this._tex_coords[ipt + 3] = iaz / tex_size_y;

            ipt += 4;
        }

        var refl_img = [];
        var ipt = 0;
        for (var iaz = 0; iaz < tex_size_y; iaz++) {
            for (var irn = 0; irn < tex_size_x; irn++) {
                var igt = l2_file.n_gates * iaz + irn;
                var color = this.color_maps[this.field](l2_file.data[igt]);
                refl_img[ipt + 0] = color[0];
                refl_img[ipt + 1] = color[1];
                refl_img[ipt + 2] = color[2];
                refl_img[ipt + 3] = color[3];
                ipt += 4;
            }
        }

        var gl = this._gl;
        this._rdr_tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._rdr_tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tex_size_x, tex_size_y, 0, gl.RGBA, 
                      gl.UNSIGNED_BYTE, new Uint8Array(refl_img));

        if (this.active) {
            this._callbacks['status'](this.get_status());
        }
        this._callbacks['redraw']();
    };

    this.Level2Layer.prototype.get_status = function() {
        if (this._l2_file !== undefined) {
            var time_parse = d3.timeParse("%Y%m%d_%H%M");
            var time_fmt = d3.timeFormat("%H%M UTC %d %b %Y");
            var time_str = time_fmt(time_parse(this._l2_file.timestamp))
            var stat = sprintf("%s %.1f\u00b0 %s (%s)", this._l2_file.site, this._l2_file.elevation, this._l2_file.field, time_str);
        }
        else {
            var stat = sprintf("Downloading %s data ...", this.site);
        }
        return stat;
    }

    this.Level2Layer.prototype.draw = function(zoom_matrix, zoom_fac) {
        if (this._l2_file === undefined) {
            return;
        }

        gl = this._gl;
        gl.useProgram(this._shader_prog);

        gl.enableVertexAttribArray(this._pos);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._posbuf);
        gl.vertexAttribPointer(this._pos, 2, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(this._texc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._texcbuf);
        gl.vertexAttribPointer(this._texc, 2, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix3fv(this._zoom, false, zoom_matrix);
        gl.uniform2f(this._rdr, this._rdr_loc[0], this._rdr_loc[1]);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._texcbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._tex_coords), gl.DYNAMIC_DRAW);

        gl.uniform1i(this._tex, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this._rdr_tex);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._posbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._pts), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this._pts.length / 2);
    };

    this.Level2Layer.prototype.layer_menu_html = function() {
        var readable_name = sprintf("%s %.1f\u00b0 %s", this.site, this.elev, this.field);
        return readable_name;
    };

    this.ColorMap = function(levels, colors) {
        return function(level) {
            this.levels = levels
            this.colors = colors;
            var color = [0, 0, 0, 0];
            for (var ilv = 0; ilv < this.levels.length - 1; ilv++) {
                if (this.levels[ilv] <= level && level < this.levels[ilv + 1]) {
                    color = this.colors[ilv];
                    break
                }
            }
            return color;
        };
    };

    this.Level2Layer.prototype.color_maps = {
        'REF': this.ColorMap(
            [5,                  10,                   15,                   20,                   25, 
             30,                 35,                   40,                   45,                   50, 
             55,                 60,                   65,                   70,                   75],
            [[0,   236, 236, 255], [1,   160, 246, 255], [0,   150, 103, 255], [0,   200, 0,   255], [0,   144, 0,   255],
             [255, 255, 0,   255], [243, 192, 0,   255], [255, 144, 0,   255], [255, 0,   0,   255], [214, 0,   0,   255],
             [192, 0,   0,   255], [255, 0,   255, 255], [153, 85,  201, 255], [0,   0,   0,   255]]
        ),
        'VEL': this.ColorMap(
            [-35                -30,                  -25,                  -20,                  -15, 
             -10,                -5,                    0,                    5,                   10, 
             15,                 20,                   25,                   30,                   35],
            [[2,   252, 2,   255], [1,   228, 1,   255], [1,   197, 1,   255], [7,   172, 4,   255], [6,   143, 3,   255],
             [4,   114, 2,   255], [124, 151, 123, 255], [152, 119, 119, 255], [137, 0,   0,   255], [162, 0,   0,   255],
             [185, 0,   0,   255], [216, 0,   0,   255], [239, 0,   0,   255], [254, 0,   0,   255]]
        ),
    };


   /********************
    * ObsLayer code
    ********************/
    this.ObsLayer = function(gl, source) {
        var _vert_shader_src = `
            attribute vec2 a_pos;
            attribute vec2 a_anch;
            attribute vec2 a_tex;
            uniform mat3 u_zoom;
            uniform vec2 u_viewport;

            varying vec2 v_tex;

            void main() {
                vec2 zoom_anch_pos = (vec3(a_anch, 1.0) * u_zoom).xy;
                vec2 zoom_pos = zoom_anch_pos + a_pos / u_viewport;
                gl_Position = vec4(zoom_pos * 2.0, 0.0, 1.0);

                v_tex = a_tex;
            }
        `;

        var _frag_shader_src = `
            precision mediump float;

            varying vec2 v_tex;
            uniform sampler2D u_tex;
            uniform vec3 u_fontcolor;

            void main() {
                vec4 color = texture2D(u_tex, v_tex);
                if (color.a < 0.1)
                    discard;
                gl_FragColor = color * vec4(u_fontcolor, 1.0);
            }
        `;

        this._gl = gl;
        this.source = source;
        this._callbacks = {};
        this._n_bytes = 52;
        this._obs_file = undefined;

        this._shader_prog = _mod.compile_shaders(gl, _vert_shader_src, _frag_shader_src);
        this._pos = gl.getAttribLocation(this._shader_prog, 'a_pos');
        this._posbuf = gl.createBuffer();
        this._anch = gl.getAttribLocation(this._shader_prog, 'a_anch');
        this._anchbuf = gl.createBuffer();
        this._texc = gl.getAttribLocation(this._shader_prog, 'a_tex');
        this._texcbuf = gl.createBuffer();
        this._tex = gl.getUniformLocation(this._shader_prog, 'u_tex');
        this._fontcolor = gl.getUniformLocation(this._shader_prog, 'u_fontcolor');
        this._zoom = gl.getUniformLocation(this._shader_prog, 'u_zoom');
        this._viewport = gl.getUniformLocation(this._shader_prog, 'u_viewport');

        this._font_tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._font_tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, _mod.font_atlas.get_texture());

        this._barb_tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._barb_tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

        this._text_from_ob = {
            'id': function(ob) {
                return ob.id;
            },
            'ta': function(ob) {
                var tmpf = ob.temperature * 9. / 5 + 32;
                var tmp_str;
                if (isNaN(tmpf)) {
                    tmp_str = ' '
                }
                else {
                    tmp_str = Math.round(tmpf).toString();
                }
                return tmp_str;
            },
            'td': function(ob) {
                var dwpf = ob.dewpoint * 9. / 5 + 32;
                var dwp_str;
                if (isNaN(dwpf)) {
                    dwp_str = ' ';
                }
                else {
                    dwp_str = Math.round(dwpf).toString()
                }
                return dwp_str;
            },
        };

        this._text_fmt = {
            'id': {'color': [0.9, 0.9, 0.9], 'align_h':'left', 'align_v':'top'},
            'ta': {'color': [0.9, 0.0, 0.0], 'align_h':'right', 'align_v':'bottom'},
            'td': {'color': [0.0, 0.8, 0.0], 'align_h':'right', 'align_v':'top'},
        }

        io.register_handler('obs.' + this.source, this.receive_data.bind(this));
        io.request({'type':'obs', 'source':this.source});
    };

    this.ObsLayer.prototype = Object.create(this.DataLayer.prototype);
    this.ObsLayer.prototype.constructor = this.ObsLayer;

    this.ObsLayer.prototype.receive_data = function(obs) {
        if (obs.error !== undefined) {
            console.log('Server error: ' + obs.error);
            return;
        }

        this._obs_file = obs;
        obs.data = new Uint8Array(obs.data.buffer);
        var n_obs = obs.data.length / this._n_bytes;

        this._text_info = {};
        for (var obvar in this._text_from_ob) {
            this._text_info[obvar] = {'anch': [], 'vert': [], 'tex': []};
        }
        this._barb_info = {'anch': [], 'vert': [], 'tex': []};

        for (var iob = 0; iob < n_obs; iob++) {
            var ob_buf = obs.data.slice(iob * this._n_bytes, (iob + 1) * this._n_bytes);
            var ob = {};

            var id = [];
            for (var ibyte = 0; ibyte < 5; ibyte++) { id.push(String.fromCharCode(ob_buf[ibyte])); }
            ob.id = id.join("");

            var time = [];
            for (var ibyte = 16; ibyte < 29; ibyte++) { time.push(String.fromCharCode(ob_buf[ibyte])); }
            ob.time = time.join("");

            var sec1 = new Float32Array(ob_buf.slice(8, 16).buffer);
            var sec2 = new Float32Array(ob_buf.slice(32, 52).buffer);

            ob.latitude    = sec1[0];
            ob.longitude   = sec1[1];
            var pos = this.map_proj([ob.longitude, ob.latitude]);
            ob.x = pos[0];
            ob.y = pos[1];
            ob.pressure    = sec2[0];
            ob.temperature = sec2[1];
            ob.dewpoint    = sec2[2];
            ob.wind_dir    = sec2[3];
            ob.wind_spd    = sec2[4];

            for (var obvar in this._text_from_ob) {
                var coords = _mod.font_atlas.gen_str(this._text_from_ob[obvar](ob), [ob.x, ob.y], 12, 
                                                     this._text_fmt[obvar]['align_h'], this._text_fmt[obvar]['align_v']);
                for (var txti in coords) {
                    this._text_info[obvar][txti].push(coords[txti]);
                }
            }
            var coords = this._gen_wind_barb([ob.x, ob.y], ob.wind_spd, ob.wind_dir);
            for (var brbi in coords) {
                this._barb_info[brbi].push(coords[brbi]);
            }
        }

        for (var obvar in this._text_info) {
            for (var txti in this._text_info[obvar]) {
                this._text_info[obvar][txti] = [].concat.apply([], this._text_info[obvar][txti]);
            }
        }
        for (var brbi in this._barb_info) {
            this._barb_info[brbi] = [].concat.apply([], this._barb_info[brbi]);
        }

        if (this.active) {
            this._callbacks['status'](this.get_status());
        }
        this._callbacks['redraw']();
    };

    this.ObsLayer.prototype.get_status = function() {
        var names = {'metar':'METAR', 'mesonet':'Mesonet'};
        if (this._obs_file !== undefined) {
            var time_parse = d3.timeParse("%Y%m%d_%H%M");
            var time_fmt = d3.timeFormat("%H%M UTC %d %b %Y");
            var time_str = time_fmt(time_parse(this._obs_file.nominal_time))
            var stat = sprintf("%s Station Plots (%s)", names[this.source], time_str);
        }
        else {
            var stat = sprintf("Downloading %s data ...", names[this.source]);
        }
        return stat;
    };

    this.ObsLayer.prototype.draw = function(zoom_matrix, zoom_fac) {
        if (this._obs_file === undefined) {
            return;
        }

        var gl = this._gl;
        gl.useProgram(this._shader_prog);

        gl.enableVertexAttribArray(this._pos);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._posbuf);
        gl.vertexAttribPointer(this._pos, 2, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(this._anch);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._anchbuf);
        gl.vertexAttribPointer(this._anch, 2, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(this._texc);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._texcbuf);
        gl.vertexAttribPointer(this._texc, 2, gl.FLOAT, false, 0, 0);

        gl.uniformMatrix3fv(this._zoom, false, zoom_matrix);
        gl.uniform2f(this._viewport, this._vp_width, this._vp_height);

        gl.uniform1i(this._tex, 2);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this._barb_tex);
        
        gl.uniform3f(this._fontcolor, 0, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._texcbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._barb_info['tex']), gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._anchbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._barb_info['anch']), gl.DYNAMIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this._posbuf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._barb_info['vert']), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, this._barb_info['vert'].length / 2);

        gl.uniform1i(this._tex, 1);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._font_tex);

        for (var obvar in this._text_info) {
            var color = this._text_fmt[obvar]['color']
            gl.uniform3f(this._fontcolor, color[0], color[1], color[2]);
            gl.bindBuffer(gl.ARRAY_BUFFER, this._texcbuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._text_info[obvar]['tex']), gl.DYNAMIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, this._anchbuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._text_info[obvar]['anch']), gl.DYNAMIC_DRAW);

            gl.bindBuffer(gl.ARRAY_BUFFER, this._posbuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this._text_info[obvar]['vert']), gl.DYNAMIC_DRAW);
            gl.drawArrays(gl.TRIANGLES, 0, this._text_info[obvar]['vert'].length / 2);
        }
    };

    this.ObsLayer.prototype.layer_menu_html = function() {
        return this.source.toUpperCase();
    };

    this.ObsLayer.prototype._gen_wind_barb = function(pos, wind_spd, wind_dir) {

        var ws_rnd = Math.round(wind_spd / 5) * 5;
        var n_flags = Math.floor(ws_rnd / 50);
        ws_rnd = ws_rnd % 50;
        var n_fbarbs = Math.floor(ws_rnd / 10);
        ws_rnd = ws_rnd % 10;
        var n_hbarbs = Math.floor(ws_rnd / 5);

        var staff_length = 40;
        var line_width = 1.5;
        var feat_width = staff_length / 3;
        var feat_space = staff_length / 8;
        
        var sqrt3 = Math.sqrt(3);
        var coords = {'anch':[], 'vert':[], 'tex':[]};

        var flag = [ [0, 0],  [0, -feat_space * 1.25], [feat_width, feat_width / sqrt3] ];
        var barb = [ 
            [0, 0],  [0, -2 * line_width / sqrt3], [feat_width, feat_width / sqrt3],
            [0, -2 * line_width / sqrt3],  [feat_width, (feat_width - 2 * line_width) / sqrt3],  [feat_width, feat_width / sqrt3]
        ];
        var half_barb = [ 
            [0, 0],  [0, -2 * line_width / sqrt3], [feat_width / 2, feat_width / (2 * sqrt3)],
            [0, -2 * line_width / sqrt3],  [feat_width / 2, (feat_width / 2 - 2 * line_width) / sqrt3],  [feat_width / 2, feat_width / (2 * sqrt3)]
        ];

        var staff = [
            [-line_width / 2, 0],  [line_width / 2, 0],  [line_width / 2, staff_length + 1 / sqrt3],
            [-line_width / 2, 0],  [line_width / 2, staff_length + 1 / sqrt3],  [-line_width / 2, staff_length - 1 / sqrt3],
        ];

        if (n_flags > 0 || n_fbarbs > 0 || n_hbarbs > 0) {

            for (var icd in staff) {
                coords['vert'].push(staff[icd]);
            }

            var feat_pos = staff_length;
            if (n_flags == 0 && n_fbarbs == 0) {
                feat_pos -= feat_space;
            }

            for (var ifeat = 0; ifeat < n_flags; ifeat++) {
                for (var icd in flag) {
                    var pt = flag[icd].slice();
                    pt[1] += feat_pos;
                    coords['vert'].push(pt);
                }
                feat_pos -= feat_space * 1.5;
            }

            for (var ifeat = 0; ifeat < n_fbarbs; ifeat++) {
                for (var icd in barb) {
                    var pt = barb[icd].slice();
                    pt[1] += feat_pos;
                    coords['vert'].push(pt);
                }
                feat_pos -= feat_space;
            }

            for (var ifeat = 0; ifeat < n_hbarbs; ifeat++) {
                for (var icd in half_barb) {
                    var pt = half_barb[icd].slice();
                    pt[1] += feat_pos;
                    coords['vert'].push(pt);
                }
                feat_pos -= feat_space;
            }

            var cs = Math.cos(-wind_dir * Math.PI / 180);
            var sn = Math.sin(-wind_dir * Math.PI / 180);

            for (var icd in coords['vert']) {
                var pt = coords['vert'][icd];
                var new_pt = [ pt[0] * cs - pt[1] * sn, pt[0] * sn + pt[1] * cs ];
                coords['vert'][icd] = new_pt;
            }
        }
        else if (isFinite(wind_spd)) {
            var circ_rad = staff_length / 6;
            var n_div = 16;
            for (var isec = 0; isec < n_div; isec++) {
                var r1 = circ_rad + line_width / 2;
                var r2 = circ_rad - line_width / 2;
                var th1 = isec * 2 * Math.PI / n_div;
                var th2 = (isec + 1) * 2 * Math.PI / n_div;

                coords['vert'].push([r1, th1]);
                coords['vert'].push([r2, th1]);
                coords['vert'].push([r1, th2]);
                coords['vert'].push([r2, th1]);
                coords['vert'].push([r2, th2]);
                coords['vert'].push([r1, th2]);
            }

            for (var icd in coords['vert']) {
                var pt = coords['vert'][icd];
                var new_pt = [ pt[0] * Math.cos(pt[1]), pt[0] * Math.sin(pt[1]) ];
                coords['vert'][icd] = new_pt;
            }
        }
        else {
            coords['vert'] = [];
        }
        coords['vert'] = [].concat.apply([], coords['vert']);

        for (var icd in coords['vert']) {
            coords['tex'].push(0.0);
            if (!(icd % 2)) { coords['anch'].push(pos[0]); }
            else            { coords['anch'].push(pos[1]); }
        }
        return coords;
    };

    this.FontAtlas = function(atlas) {
        this._atlas = atlas;
    };

    this.FontAtlas.prototype.gen_char = function(chrc, chr_hgt) {
        if (!this._atlas.glyphs.hasOwnProperty(chrc)) {
            chrc = ' ';
        }

        var glyph_info = this._atlas.glyphs[chrc];
        var img_wid = this._atlas.texture.width;
        var img_hgt = this._atlas.texture.height;
        var size_fac = chr_hgt / this._atlas.line_height;

        var x1 = 0;
        var y1 = 0; 
        var x2 = (glyph_info.width) * size_fac;
        var y2 = (this._atlas.glyph_height) * size_fac;

        var verts = [
            x1, y1,  x2, y1,  x1, y2,  x1, y2,  x2, y1,  x2, y2
        ];

        var x1 = glyph_info.xpos / img_wid;
        var y1 = glyph_info.ypos / img_hgt;
        var x2 = (glyph_info.xpos + glyph_info.width) / img_wid;
        var y2 = (glyph_info.ypos + this._atlas.glyph_height) / img_hgt;

        var tex_coords = [
            x1, y1,  x2, y1,  x1, y2,  x1, y2,  x2, y1,  x2, y2
        ];
        return { 'vert':verts, 'tex':tex_coords };
    };

    this.FontAtlas.prototype.gen_str = function(str, pos, str_hgt, align_h, align_v) {
        if (align_h === undefined) { align_h = 'left'; }
        if (align_v === undefined) { align_v = 'top'; }

        var chars = str.split('');
        var verts = [];
        var tex_coords = [];
        var anchs = [];
        var str_wid = 0;
        for (ichr in chars) {
            var coords = this.gen_char(chars[ichr], str_hgt);
            for (icd in coords.vert) {
                if (!(icd % 2)) { coords.vert[icd] += str_wid; }
            }

            for (icd in coords.vert) {
                if (!(icd % 2)) { str_wid = Math.max(str_wid, coords.vert[icd]); }
            }

            for (var icd = 0; icd < coords.vert.length / 2; icd++) {
                anchs.push(pos);
            }

            verts.push(coords.vert);
            tex_coords.push(coords.tex);
        }

        anchs = [].concat.apply([], anchs)
        verts = [].concat.apply([], verts)
        tex_coords = [].concat.apply([], tex_coords)

        var align_fac_h = -3;
        var align_fac_v = -3;
        if (align_h == 'right') {
            align_fac_h = str_wid + 3;
        }
        else if (align_h == 'center') {
            align_fac_h = str_wid / 2;
        }

        if (align_v == 'bottom') {
            align_fac_v = str_hgt + 3;
        }
        else if (align_v == 'center') {
            align_fac_v = str_hgt / 2;
        }

        for (icd in verts) {
            if (!(icd % 2)) { verts[icd] = verts[icd] - align_fac_h; }
            else { verts[icd] = -(verts[icd] - align_fac_v); }
        }

        return { 'anch':anchs, 'vert': verts, 'tex': tex_coords};
    }

    this.FontAtlas.prototype.get_texture = function() {
        return this._atlas.texture;
    }

    this.compile_shaders = function(gl, vert_shader_src, frag_shader_src) {
        var compile_shader = function(type, src) {
            var shader = gl.createShader(type);
            gl.shaderSource(shader, src);
            gl.compileShader(shader);
            var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
            if (success) {
                return shader;
            }

            console.log(gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
        }

        var vert_shader = compile_shader(gl.VERTEX_SHADER, vert_shader_src);
        var frag_shader = compile_shader(gl.FRAGMENT_SHADER, frag_shader_src);

        shader_prog = gl.createProgram();
        gl.attachShader(shader_prog, vert_shader);
        gl.attachShader(shader_prog, frag_shader);
        gl.linkProgram(shader_prog);

        var link_success = gl.getProgramParameter(shader_prog, gl.LINK_STATUS);
        if (link_success) {
            return shader_prog
        }

        console.log(gl.getProgramInfoLog(shader_prog));
        gl.deleteProgram(shader_prog);

    };
    return new gui()
})
