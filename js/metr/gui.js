
define(['d3', 'd3-geo', 'metr/io', 'sprintf'], function(d3, d3geo, io, sprintf) {
    var _mod = this;
    var sprintf = sprintf.sprintf;

    var gui = function() {
        var _this = this;

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

            var shp_layer = new ShapeLayer(gl, 'geo', 'us_cty');
            shp_layer.set_map_projection(_this.map_proj);
            shp_layer.register_callback('redraw', _this.draw);
            shp_layer.register_callback('status', _this.set_status);
            _this.draw_order.push(shp_layer);

            shp_layer = new ShapeLayer(gl, 'geo', 'us_st');
            shp_layer.set_map_projection(_this.map_proj);
            shp_layer.set_linewidth(2);
            shp_layer.register_callback('redraw', _this.draw);
            shp_layer.register_callback('status', _this.set_status);
            _this.draw_order.push(shp_layer);

            var l2_layer = new Level2Layer(gl, 'KTLX', 'REF', 0.5);
            l2_layer.set_map_projection(_this.map_proj);
            l2_layer.register_callback('redraw', _this.draw);
            l2_layer.register_callback('status', _this.set_status);
            _this.draw_order.unshift(l2_layer);

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
                _this.draw();
            });

            _this.map.call(d3.zoom().scaleExtent([0.5, 240]).on("zoom", _this.zoom))
        };

        this.zoom = function() {
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
                    _this.draw_order[ilyr].layer_menu(ul);
                }

                var width = parseInt(_this._menu_bar_width, 10) - 10;
                ul.selectAll('li').style('width', width + 'px');
                ul.selectAll('li').call(d3.drag().on('start', _this._drag_layers));

                ul.append('li').html('+').attr('class', 'addnew').on('click', function() { _this._add_menu(this); });
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
            var dx = d3.event.x - mkr_pos.left;
            var dy = d3.event.y - mkr_pos.top;

            lyr_marker.style('position', 'absolute').style('left', mkr_pos.left).style('top', mkr_pos.top);

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

        this._add_menu = function(root) {
            console.log('Popup menu!');
        };
    };

    this.ShapeLayer = function(gl, cls, name) {
        var _this = this;

        this.init = function(gl, cls, name) {
            _this._gl = gl;
            _this._callbacks = {};

            _this.cls = cls
            _this.name = name

            _this._shader_prog = _mod.compile_shaders(gl, _vert_shader_src, _frag_shader_src);
            _this._pos = gl.getAttribLocation(_this._shader_prog, 'a_pos');
            _this._posbuf = gl.createBuffer();
            _this._zoom = gl.getUniformLocation(_this._shader_prog, 'u_zoom');
            _this._delta = gl.getUniformLocation(_this._shader_prog, 'u_delta');
            _this.set_linewidth(1);

            _this._proj_data = [];
            var tag = sprintf('shapefile.%s.%s', cls, name);
            io.register_handler(tag, _this.receive_data);
            io.request({'type':'shapefile', 'domain':cls, 'name':name});
        };

        this.receive_data = function(shp_file) {
            _this._proj_data = [];
            var ipp = 0;
            for (var ipt = 0; ipt < shp_file.data.length; ipt++) {
                if (isNaN(shp_file.data[ipt])) {
                    _this._proj_data[ipp] = NaN;
                    _this._proj_data[ipp + 1] = NaN;
                }
                else {
                    var raw_pt = [shp_file.data[ipt], shp_file.data[ipt + 1]];
                    var proj_pt = _this.map_proj(raw_pt);
                    _this._proj_data[ipp] = proj_pt[0];
                    _this._proj_data[ipp + 1] = proj_pt[1];
                    ipt++;
                }
                ipp += 2;
            }
            _this._callbacks['redraw']();
        };

        this.draw = function(zoom_matrix, zoom_fac) {
            if (_this._proj_data == []) {
                return;
            }

            gl = _this._gl;
            gl.useProgram(_this._shader_prog);
            gl.enableVertexAttribArray(_this._pos);
            gl.bindBuffer(gl.ARRAY_BUFFER, _this._posbuf);
            gl.vertexAttribPointer(_this._pos, 2, gl.FLOAT, false, 0, 0);
            gl.uniformMatrix3fv(_this._zoom, false, zoom_matrix);

            for (ivec in _this._delta_vectors) {
                vec = _this._delta_vectors[ivec];

                gl.uniform2f(_this._delta, vec[0] / zoom_fac, vec[1] / zoom_fac); 
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(_this._proj_data), gl.DYNAMIC_DRAW);
                gl.drawArrays(gl.LINE_STRIP, 0, _this._proj_data.length / 2);
            }
        };

        this.layer_menu = function(root) {
            var names = {'us_cty':'Geography:<br>US Counties', 'us_st':'Geography:<br>US States'};
            var readable_name = names[_this.name];
            root.append('li').html(readable_name);
        };

        this.set_map_projection = function(map_proj){
            _this.map_proj = map_proj;
        };

        this.set_linewidth = function(linewidth) {
            _this.linewidth = linewidth;
            _this._delta_vectors = _this._compute_delta_vectors(_this.linewidth);
        };

        this.register_callback = function(action, cb) {
            _this._callbacks[action] = cb;
        };

        this._compute_delta_vectors = function(linewidth) {
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

            void main() {
                gl_FragColor = vec4(0, 0, 0, 1);
            }
        `;

        this.init(gl, cls, name);
    };

    this.Level2Layer = function(gl, site, field, elev) {
        var _this = this;

        this.init = function(gl, site, field, elev) {
            _this._gl = gl;
            _this._callbacks = {};

            _this.site = site;
            _this.field = field;
            _this.elev = elev;

            _this._pos = gl.getAttribLocation(Level2Layer._shader_prog, 'a_pos');
            _this._posbuf = gl.createBuffer();
            _this._texc = gl.getAttribLocation(Level2Layer._shader_prog, 'a_tex');
            _this._texcbuf = gl.createBuffer();
            _this._tex = gl.getUniformLocation(Level2Layer._shader_prog, 'u_tex');
            _this._zoom = gl.getUniformLocation(Level2Layer._shader_prog, 'u_zoom');
            _this._rdr = gl.getUniformLocation(Level2Layer._shader_prog, 'u_rdr_pos');

            var int_deg = Math.floor(elev);
            var frc_deg = Math.round((elev - int_deg) * 10);
            var tag = sprintf("level2radar.%s.%s.%02dp%1d", site, field, int_deg, frc_deg);
            io.register_handler(tag, _this.receive_data);
            io.request({'type':'level2radar', 'site':site, 'field':field, 'elev':elev});
        };

        this.receive_data = function(l2_file) {
            _this._l2_file = l2_file
            _this._rdr_loc = _this.map_proj([l2_file.site_longitude, l2_file.site_latitude]);
            var start_loc = _this.map_proj([l2_file.first_longitude, l2_file.first_latitude]);

            var rdr_px = _this._rdr_loc;
            var start_px = start_loc;

            var st_rn = Math.sqrt((start_px[0] - rdr_px[0]) ** 2 + (start_px[1] - rdr_px[1]) ** 2);
            var st_az = Math.atan2(start_px[1] - rdr_px[1], start_px[0] - rdr_px[0]) * 180 / Math.PI;
            var drng = 250 * st_rn / l2_file.st_range;
            var dazim;
            var tex_size_x = l2_file.n_gates;
            var tex_size_y = l2_file.n_rays;
            if (l2_file.n_rays == 720) {
                dazim = 0.5;
            }
            else {
                dazim = 1.0;
            }

            var ipt = 0;
            _this._pts = [];
            _this._tex_coords = [];
            for (var iaz = 0; iaz < l2_file.n_rays + 1; iaz++) {
                _this._pts[ipt + 0] = (st_rn + (l2_file.n_gates + 0.5) * drng);
                _this._pts[ipt + 1] = (st_az + (iaz - 0.5) * dazim) * Math.PI / 180.;
                _this._pts[ipt + 2] = (st_rn - 0.5 * drng);
                _this._pts[ipt + 3] = (st_az + (iaz - 0.5) * dazim) * Math.PI / 180.;

                _this._tex_coords[ipt + 0] = l2_file.n_gates / tex_size_x;
                _this._tex_coords[ipt + 1] = iaz / tex_size_y;
                _this._tex_coords[ipt + 2] = 0.0;
                _this._tex_coords[ipt + 3] = iaz / tex_size_y;

                ipt += 4;
            }

            var refl_img = [];
            var ipt = 0;
            for (var iaz = 0; iaz < tex_size_y; iaz++) {
                for (var irn = 0; irn < tex_size_x; irn++) {
                    var igt = l2_file.n_gates * iaz + irn;
                    var color = _this._reflectivity_color_map(l2_file.data[igt]);
                    refl_img[ipt + 0] = color[0];
                    refl_img[ipt + 1] = color[1];
                    refl_img[ipt + 2] = color[2];
                    refl_img[ipt + 3] = color[3];
                    ipt += 4;
                }
            }

            var gl = _this._gl;
            _this._rdr_tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, _this._rdr_tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tex_size_x, tex_size_y, 0, gl.RGBA, 
                          gl.UNSIGNED_BYTE, new Uint8Array(refl_img));

            _this._callbacks['redraw']();

            var time_parse = d3.timeParse("%Y%m%d_%H%M");
            var time_fmt = d3.timeFormat("%H%M UTC %d %b %Y");
            var time_str = time_fmt(time_parse(_this._l2_file.timestamp))
            var stat_str = sprintf("%s %.1f\u00b0 %s (%s)", _this._l2_file.site, _this._l2_file.elevation, _this._l2_file.field, time_str);

            _this._callbacks['status'](stat_str);
        };

        this.draw = function(zoom_matrix, zoom_fac) {
            if (_this._l2_file === undefined) {
                return;
            }

            gl = _this._gl;
            gl.useProgram(Level2Layer._shader_prog);

            gl.enableVertexAttribArray(_this._pos);
            gl.bindBuffer(gl.ARRAY_BUFFER, _this._posbuf);
            gl.vertexAttribPointer(_this._pos, 2, gl.FLOAT, false, 0, 0);

            gl.enableVertexAttribArray(_this._texc);
            gl.bindBuffer(gl.ARRAY_BUFFER, _this._texcbuf);
            gl.vertexAttribPointer(_this._texc, 2, gl.FLOAT, false, 0, 0);

            gl.uniformMatrix3fv(_this._zoom, false, zoom_matrix);
            gl.uniform2f(_this._rdr, _this._rdr_loc[0], _this._rdr_loc[1]);

            gl.bindBuffer(gl.ARRAY_BUFFER, _this._texcbuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(_this._tex_coords), gl.DYNAMIC_DRAW);

            gl.uniform1i(_this._tex, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, _this._posbuf);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(_this._pts), gl.DYNAMIC_DRAW);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, _this._pts.length / 2);
        };

        this.layer_menu = function(root) {
            var readable_name = sprintf("Level 2 Radar:<br>%s %.1f\u00b0 %s", _this.site, _this.elev, _this.field);
            root.append('li').html(readable_name);
        };

        this.set_map_projection = function(map_proj){
            _this.map_proj = map_proj;
        };

        this.register_callback = function(action, cb) {
            _this._callbacks[action] = cb;
        };

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
                gl_FragColor = texture2D(u_tex, v_tex);
            }
        `;

        Level2Layer._shader_prog = _mod.compile_shaders(gl, _vert_shader_src, _frag_shader_src);

        this._reflectivity_color_map = function(ref) {
            var color;
            if (ref < 5) { color = [0, 0, 0, 0]; }
            else if (ref >= 5  && ref < 10) { color = [0,   236, 236, 255]; }
            else if (ref >= 10 && ref < 15) { color = [1,   160, 246, 255]; }
            else if (ref >= 15 && ref < 20) { color = [0,   255, 246, 255]; }
            else if (ref >= 20 && ref < 25) { color = [0,   200, 0,   255]; }
            else if (ref >= 25 && ref < 30) { color = [0,   144, 0,   255]; }
            else if (ref >= 30 && ref < 35) { color = [255, 255, 0,   255]; }
            else if (ref >= 35 && ref < 40) { color = [243, 192, 0,   255]; }
            else if (ref >= 40 && ref < 45) { color = [255, 144, 0,   255]; }
            else if (ref >= 45 && ref < 50) { color = [255, 0,   0,   255]; }
            else if (ref >= 50 && ref < 55) { color = [214, 0,   0,   255]; }
            else if (ref >= 55 && ref < 60) { color = [192, 0,   0,   255]; }
            else if (ref >= 60 && ref < 65) { color = [255, 0,   255, 255]; }
            else if (ref >= 65 && ref < 70) { color = [153, 85,  201, 255]; }
            else if (ref >= 70 && ref < 75) { color = [0,   0,   0,   255]; }
            else { color = [0, 0, 0, 0]; }
            return color;
        }

        this.init(gl, site, field, elev);
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
