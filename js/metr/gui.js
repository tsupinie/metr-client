
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

            io.download_shape('/geo/us_cty.json', function(shp_file) {
                _this.add_shape(shp_file);

                window.addEventListener('resize', function() {
                    _this.map.node().width = window.innerWidth;
                    _this.map.node().height = window.innerHeight;
                    var old_width = _this.width;
                    var old_height = _this.height;
                    _this.width = _this.map.node().width
                    _this.height = _this.map.node().height

                    _this.status.style('top', _this.height - _this._stat_hgt).style('height', _this.stat_hgt);
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
            });

            io.download_88d_list(function(wsrdf) {
                _mod.wsr88ds = wsrdf;
                io.download_level2('KCRP', new Date(2017, 7, 26, 1, 53), 'REF', 0.5, function(l2_file) {
                    _this.add_level2(l2_file);
                });
            });

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
                _this.draw_order[ilyr].draw(zoom_matrix);
            }
        };

        this.add_shape = function(shp_file) {
            var gl = _this.map.node().getContext('webgl');
            _this.draw_order.push(new ShapeLayer(gl, _this.map_proj, shp_file));
            _this.draw();
        };

        this.add_level2 = function(l2_file) {
            var gl = _this.map.node().getContext('webgl');
            var time_parse = d3.timeParse("%Y%m%d_%H%M");
            var time_fmt = d3.timeFormat("%H%M UTC %d %b %Y");
            var time_str = time_fmt(time_parse(l2_file.timestamp))
            var stat_str = sprintf("%s %.1f\u00b0 %s (%s)", l2_file.site, l2_file.elevation, l2_file.field, time_str);
            _this.set_status(stat_str);

            _this.draw_order.unshift(new Level2Layer(gl, _this.map_proj, l2_file));
            _this.draw();
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
            },
            'default': function() {
                _this.menu.html("");
            }
        };

        this.toggle_menu_bar = function() {
            var trans = d3.transition().duration(500);
            var bar_width = '150px';
            if (_this.menu_visible == "") {
                _this.menu.style('width', bar_width).style('left', '-' + bar_width);
                _this.menu.transition(trans).style('left', '0px');
                _this.menu_tabs.transition(trans).style('left', bar_width);
            }
            else {
                _this.menu.transition(trans).style('left', '-' + bar_width);
                _this.menu_tabs.transition(trans).style('left', '0px');
            }
        };
    };

    this.ShapeLayer = function(gl, map_proj, shp_file) {
        var _this = this;

        this.init = function(gl, map_proj, shp_file) {
            _this._gl = gl;
            _this._shader_prog = _mod.compile_shaders(gl, _this._vert_shader_src, _this._frag_shader_src);

            _this._pos = gl.getAttribLocation(_this._shader_prog, 'a_pos');
            _this._posbuf = gl.createBuffer();
            _this._zoom = gl.getUniformLocation(_this._shader_prog, 'u_zoom');

            _this._proj_data = [];
            var ipd = 0;
            for (ishp in shp_file.data) {
                for (ipt in shp_file.data[ishp]) {
                    proj_pt = map_proj(shp_file.data[ishp][ipt]);
                    _this._proj_data[ipd] = proj_pt[0];
                    _this._proj_data[ipd + 1] = proj_pt[1];
                    ipd += 2;
                }
                _this._proj_data[ipd] = NaN;
                _this._proj_data[ipd + 1] = NaN;
                ipd += 2;
            }
        };

        this.draw = function(zoom_matrix) {
            gl = _this._gl;
            gl.useProgram(_this._shader_prog);
            gl.enableVertexAttribArray(_this._pos);
            gl.bindBuffer(gl.ARRAY_BUFFER, _this._posbuf);
            gl.vertexAttribPointer(_this._pos, 2, gl.FLOAT, false, 0, 0);
            gl.uniformMatrix3fv(_this._zoom, false, zoom_matrix);

            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(_this._proj_data), gl.DYNAMIC_DRAW);
            gl.drawArrays(gl.LINE_STRIP, 0, _this._proj_data.length / 2);
        };

        this.layer_menu = function(root) {

        };

        this._vert_shader_src = `
            attribute vec2 a_pos;
            uniform mat3 u_zoom;

            void main() {
                vec2 zoom_pos = (vec3(a_pos, 1.0) * u_zoom).xy;
                gl_Position = vec4(zoom_pos * 2.0, 0.0, 1.0);
            }
        `;

        this._frag_shader_src = `
            precision mediump float;

            void main() {
                gl_FragColor = vec4(0, 0, 0, 1);
            }
        `;

        this.init(gl, map_proj, shp_file);
    };

    this.Level2Layer = function(gl, map_proj, l2_file) {
        var _this = this;

        this.init = function(gl, map_proj, l2_file) {
            _this._rdr_loc = map_proj([l2_file.site_longitude, l2_file.site_latitude]);
            start_loc = map_proj([l2_file.first_longitude, l2_file.first_latitude]);

            rdr_px = _this._rdr_loc
            start_px = start_loc

            _this._gl = gl;
            _this._shader_prog = _mod.compile_shaders(gl, _this._vert_shader_src, _this._frag_shader_src);
            _this._pos = gl.getAttribLocation(_this._shader_prog, 'a_pos');
            _this._posbuf = gl.createBuffer();
            _this._texc = gl.getAttribLocation(_this._shader_prog, 'a_tex');
            _this._texcbuf = gl.createBuffer();
            _this._tex = gl.getUniformLocation(_this._shader_prog, 'u_tex');
            _this._zoom = gl.getUniformLocation(_this._shader_prog, 'u_zoom');
            _this._rdr = gl.getUniformLocation(_this._shader_prog, 'u_rdr_pos');

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
                    if (iaz < l2_file.n_rays && irn < l2_file.n_gates) { 
                        var igt = l2_file.n_gates * iaz + irn;
                        var color = _this._reflectivity_color_map(l2_file.data[igt]);
                        refl_img[ipt + 0] = color[0];
                        refl_img[ipt + 1] = color[1];
                        refl_img[ipt + 2] = color[2];
                        refl_img[ipt + 3] = color[3];
                    }
                    else {
                        refl_img[ipt + 0] = 0
                        refl_img[ipt + 1] = 0
                        refl_img[ipt + 2] = 0
                        refl_img[ipt + 3] = 0
                    }
                    ipt += 4;
                }
            }

            _this._rdr_tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, _this._rdr_tex);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tex_size_x, tex_size_y, 0, gl.RGBA, 
                          gl.UNSIGNED_BYTE, new Uint8Array(refl_img));
        };

        this.draw = function(zoom_matrix) {
            gl = _this._gl;
            gl.useProgram(_this._shader_prog);

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
            
        };

        this._get_site_info = function(site) {
            var site_info;
            for (i88d in _mod.wsr88ds) {
                if (_mod.wsr88ds[i88d].id == site) {
                    site_info = _mod.wsr88ds[i88d];
                    break;
                }
            }
            return site_info;
        };

        this._vert_shader_src = `
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

        this._frag_shader_src = `
            precision mediump float;

            varying vec2 v_tex;
            uniform sampler2D u_tex;

            void main() {
                gl_FragColor = texture2D(u_tex, v_tex);
            }
        `;

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

        this.init(gl, map_proj, l2_file);
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
