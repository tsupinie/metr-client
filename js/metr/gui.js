
define(['d3', 'd3-geo', 'metr/io', 'metr/utils', 'metr/mapping', 'sprintf'], function(d3, d3geo, io, utils, geo, sprintf) {
    var _mod = this;
    var sprintf = sprintf.sprintf;

    this.Menu = function(tree, width) {
        this.tree = tree;
        this._width = width
        this._depth = 0;
        this._setup(this);
    };

    this.Menu.prototype._setup = function(parent) {
        if (parent === this) { 
            this._parent = undefined;
        }
        else {
            this._parent = parent
            this._depth = parent._depth + 1;
            this._width = parent._width;
        }

        for (var ichl in this.tree) {
            if (this.tree[ichl] instanceof Menu) {
                this.tree[ichl]._setup(this);
            }
        }
    };

    this.Menu.prototype.path_to_action = function(act) {
        for (var item in this.tree) {
            if (this.tree[item] === act) {
                return item
            }
            else if (this.tree[item] instanceof Menu) {
                var subpath = this.tree[item].path_to_action(act);
                if (subpath !== null) {
                    return item + '/' + subpath
                }
            }
        }
        return null;
    };

    this.Menu.prototype.show = function(root) {
        var root_rect = root.node().getBoundingClientRect();
        remove_menu(this._depth);
        menu_root = d3.select('body').append('ul')
                                     .attr('id', 'popup' + this._depth)
                                     .style('position', 'absolute')
                                     .style('left', root_rect.right + 3)
                                     .style('top', root_rect.top - 2)
                                     .style('width', this._width)
                                     .style('margin-top', 0)
                                     .style('z-index', 15)
                                     .style('background', 'rgba(0, 0, 0, 0.3)');

        root.node().sub_menu = menu_root.node();
        menu_root.node().menu_parent = root;
        var _this = this;

        function remove_menu(depth) {
            var sub_menu = d3.select('#popup' + depth);
            while (!sub_menu.empty()) {
                var sub_menu_root = sub_menu.node().menu_parent;
                sub_menu.remove();

                if (sub_menu_root !== undefined) {
                    if (depth == 0) {
                        d3.select('body').on('click', function() {});
                        sub_menu_root.on('click', _this.old_click_handler);
                    }
                    else {
                        sub_menu_root.on('click', add_submenu);
                    }
                }

                depth++;
                sub_menu = d3.select('#popup' + depth);
            }
        }

        function add_submenu() {
            if (this.menu instanceof MenuAction) {
                // Leaf node (run the menu action)
                if (this.menu.available) {
                    this.menu.available = false;
                    this.menu.perform_action();
                    remove_menu(0);
                }
                d3.event.stopPropagation();
            }
            else {
                // Actual submenu (show the submenu)
                this.menu.show(d3.select(this));
            }
        }

        for (var opt in this.tree) {
            menu_item = menu_root.append('li')
                                 .style('height', '26px')
                                 .style('line-height', '26px')
                                 .style('vertical-align', 'middle')
                                 .style('padding-left', '3px')
                                 .style('cursor', 'pointer')
                                 .style('margin', '2px')
                                 .style('background-color', '#222222')
                                 .style('color', '#ffffff')
                                 .style('font-size', '10pt')
                                 .style('border-radius', '2px')
                                 .style('user-select', 'none')
                                 .text(opt)

            if (this.tree[opt] instanceof Menu) {
                menu_item.append('div')
                         .style('float', 'right')
                         .style('height', '26px')
                         .style('line-height', '26px')
                         .style('vertical-align', 'middle')
                         .style('padding', '0px')
                         .style('width', '12px')
                         .style('margin', '0px')
                         .text('>')
            }
            menu_item.node().menu = this.tree[opt];
        }

        menu_root.selectAll('li').on('click', add_submenu);
        if (this._depth == 0) {
            d3.select('body').on('click', function() {
                remove_menu(0);
            });
        }

        this.old_click_handler = root.on('click');
        root.on('click', function() {
            remove_menu(_this._depth);
        });
        d3.event.stopPropagation();
    };

    this.MenuAction = function(action, def_avail) {
        if (def_avail === undefined) { def_avail = true; }

        this._act = action;
        this.available = def_avail;
    };

    this.MenuAction.prototype.perform_action = function() {
        this._act.apply(this, arguments);
    };

    var METRGUI = function() {
    };

    METRGUI.prototype.init_map = function() {
        var _this = this;

        this.dpr = window.devicePixelRatio || 1;
        this.map = d3.select('#main');
        this.map.node().width = window.innerWidth * this.dpr;
        this.map.node().height = window.innerHeight * this.dpr;
        this.map.style('background-color', '#cccccc');

        this.width = this.map.node().width
        this.height = this.map.node().height
        this.init_width = this.width;
        this.init_height = this.height;

        this._menu_bar_width = '175px';
        this._stat_hgt = 25
        this.status = d3.select('#status');
        this.status.style('height', this._stat_hgt).style('top', this.height / this.dpr - this._stat_hgt)

        this.menu = d3.select('#menu');
        this.menu.style('height', this.height / this.dpr - this._stat_hgt)
        this.menu_tabs = d3.select('#menutabs');
        this.menu_tabs.selectAll('li').on('click', function() { _this.toggle_menu(this); });
        this.menu_visible = "";

        this.anim = d3.select('#anim');
        this.anim.html('<div id="play">&#x25b6;&#9616;&#9616;</div><div id="framelist"></div>')

        this._anim_hgt = 30;
        var anim_rect = this.anim.node().getBoundingClientRect()
        this.anim.style('height', this._anim_hgt)
                 .style('line-height', this._anim_hgt + 'px')
                 .style('left', this.width / this.dpr - anim_rect.width);

        this.trans_x = 0;
        this.trans_y = 0;
        this.set_zoom(d3.zoomTransform(this.map.node()));

        var parallels = [30, 45];
        var std_lon = -97.5;
        var std_lat = 37.5;

        this.map_geo = new geo.lcc(std_lon, std_lat, parallels[0], parallels[1]);

        this.max_age = 3600;

        io.register_handler('gui', this.receive_data.bind(this));
        io.request({'action':'activate', 'type':'gui', 'static':'wsr88ds'});

        this.layer_container = new LayerContainer(this._menu_bar_width);

        this.anim.select('div#play')
                 .on('click', this.layer_container.toggle_animation.bind(this.layer_container));

        var gl = this.map.node().getContext('webgl');

        d3.json('trebuchet.atlas', function(atlas) {
            var texture_data = atlas.texture;
            atlas.texture = new Image();
            atlas.texture.onload = function(event) {
                _mod.font_atlas = new FontAtlas(atlas);
                _this.layer_container.init();
            }
            atlas.texture.src = 'data:image/png;base64,' + texture_data;
        });

        window.addEventListener('resize', function() {
            _this.map.node().width = window.innerWidth * _this.dpr;
            _this.map.node().height = window.innerHeight * _this.dpr;
            var old_width = _this.width;
            var old_height = _this.height;
            _this.width = _this.map.node().width
            _this.height = _this.map.node().height

            _this.status.style('top', _this.height / _this.dpr - _this._stat_hgt).style('height', _this.stat_hgt);
            _this.menu.style('height', _this.height / _this.dpr - _this._stat_hgt)

            var anim_rect = _this.anim.node().getBoundingClientRect()
            _this.anim.style('left', _this.width / _this.dpr - anim_rect.width);
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
            _this.layer_container.set_layer_viewports(_this.width, _this.height);
            _this.draw();
        });

        var trans = d3.zoomIdentity
        if (utils.get_cookie('zoom_k') !== undefined) {
            var zoom_k = utils.get_cookie('zoom_k');
            var zoom_x = utils.get_cookie('zoom_x');
            var zoom_y = utils.get_cookie('zoom_y');

            trans = trans.translate(zoom_x, zoom_y).scale(zoom_k);
        }

        var zoom = d3.zoom().scaleExtent([0.5, 480]).on("zoom", function() { _this.zoom(); })
        this.map.call(zoom).call(zoom.transform, trans);
    };

    METRGUI.prototype.receive_data = function(data) {
        if ('wsr88ds' in data) {
            this.wsr88ds = data['wsr88ds'];
        }
    }

    METRGUI.prototype.zoom = function() {
        utils.set_cookie('zoom_k', d3.event.transform.k.toString());
        utils.set_cookie('zoom_x', d3.event.transform.x.toString());
        utils.set_cookie('zoom_y', d3.event.transform.y.toString());

        this.set_zoom(d3.event.transform);
        this.draw();
    };

    METRGUI.prototype.set_zoom = function(base_trans) {
        this.zoom_trans = base_trans.translate(this.width / 2 + this.trans_x, this.height / 2 + this.trans_y);
    }

    METRGUI.prototype.draw = function() {
        var gl = this.map.node().getContext('webgl');
        gl.viewport(0, 0, this.width, this.height);
        gl.clearColor(0.8, 0.8, 0.8, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        var px_width = this.width / this.dpr;
        var px_height = this.height / this.dpr;

        kx = this.zoom_trans.k / px_width;
        ky = this.zoom_trans.k / px_height;
        tx = (this.zoom_trans.x - px_width / 2) / this.zoom_trans.k;
        ty = (this.zoom_trans.y - px_height / 2) / this.zoom_trans.k;
        zoom_matrix = [kx, 0, kx * tx, 0, -ky, -ky * ty, 0, 0, 1]

        if (this.map_picker !== undefined) {
            this.map_picker.draw(this.zoom_trans);
        }
        this.layer_container.draw_layers(zoom_matrix, this.zoom_trans.k);
    };

    METRGUI.prototype.create_layer = function(callback, LayerType) {
        var args = Array.prototype.slice.call(arguments, 2);
        var gl = this.map.node().getContext('webgl');
        args.splice(0, 0, gl, this.map_geo, this.max_age);

        var lyr = Object.create(LayerType.prototype);
        LayerType.apply(lyr, args);

        lyr.set_viewport(this.width, this.height);
        lyr.active = false;

        callback(lyr);
    };

    METRGUI.prototype.set_status = function(layer) {
        layer.set_status(this.status);
    };

    METRGUI.prototype.toggle_menu = function(menu_item) {
        var unselected = "rgba(0, 0, 0, 0.6)";
        var selected = "rgba(77, 77, 77, 0.6)";
        var menu_name = menu_item.innerHTML;
        if (this.menu_visible == menu_item) {
            this.menu.node().style.background = unselected;
            menu_item.style.background = unselected;
            this.toggle_menu_bar();

            this.menu_visible = "";
        }
        else {
            if (this.menu_visible != "") {
                this.menu_visible.style.background = unselected;
            }
            this.menu.node().style.background = selected;
            menu_item.style.background = selected;

            if (this.menu_visible == "") {
                this.toggle_menu_bar();
            }

            try {
                this.show_menu(menu_item.innerHTML);
            }
            catch (err) {
                this.show_menu('default');
            }
            this.menu_visible = menu_item;
        }
    };

    METRGUI.prototype.refresh_menu = function() {
        if (this.menu_visible != "") {
            this.show_menu(this.menu_visible.innerHTML);
        }
    };

    METRGUI.prototype.show_menu = function(menu) {
        this.menu.html("");

        var procedures = {
            'Layers': (function() {
                this.layer_container.create_layer_menu(this.menu);
            }).bind(this),
            'About': (function() {
                this.menu.append('div')
                         .attr('id', 'about')
                         .html('<h1>METR</h1>' +
                               '<h3>Nowcasting Tool</h3>' +
                               '<p>v1.0 (1 October 2018)</p>' +
                               '<p>&copy; 2018 Tim Supinie</p>' +
                               '<p>I\'d like to thank the Oklahoma Climate Survey for their wonderful WeatherScope program, to which I consider METR a direct successor.</p>');
            }).bind(this),
            'default': (function() {}).bind(this)
        };

        procedures[menu]();
    };

    METRGUI.prototype.toggle_menu_bar = function() {
        var trans = d3.transition().duration(500);
        if (this.menu_visible == "") {
            this.menu.style('width', this._menu_bar_width).style('left', '-' + this._menu_bar_width);
            this.menu.transition(trans).style('left', '0px');
            this.menu_tabs.transition(trans).style('left', this._menu_bar_width);
        }
        else {
            this.menu.transition(trans).style('left', '-' + this._menu_bar_width);
            this.menu_tabs.transition(trans).style('left', '0px');
        }
    };

    METRGUI.prototype.level2_picker = function(menu_action) {
        var data = [];
        for (idat in this.wsr88ds) {
            data[idat] = {};
            data[idat]['latitude'] = this.wsr88ds[idat]['latitude'];
            data[idat]['longitude'] = this.wsr88ds[idat]['longitude'];
            data[idat]['text'] = this.wsr88ds[idat]['id'];
        }

        var _this = this;
        var menu_adder = function(pos) {
            return function(lyr) {
                lyr.menu_action = menu_action;
                _this.layer_container.add_layer(lyr, pos);
            }
        };

        this.map_picker = new MapPicker(this.map_geo, data, function(root) {
            var _popup = new Menu({
                'Reflectivity': new MenuAction(function () {
                    menu_action.available = false;
                    _this.remove_map_picker();
                    gui.create_layer(menu_adder(-1), Level2Layer, root.text(), 'REF', 0.5);
                }),
                'Velocity': new MenuAction(function () {
                    menu_action.available = false;
                    _this.remove_map_picker();
                    gui.create_layer(menu_adder(-1), Level2Layer, root.text(), 'VEL', 0.5);
                }),
                'Correlation Coefficient': new MenuAction(function () {
                    menu_action.available = false;
                    _this.remove_map_picker();
                    gui.create_layer(menu_adder(-1), Level2Layer, root.text(), 'CCR', 0.5);
                }),
            }, '150px')
            _popup.show(root)
        });

        this.draw();
    };

    METRGUI.prototype.remove_map_picker = function() {
        if (this.map_picker !== undefined) {
            this.map_picker.clear();
            this.map_picker = undefined;
        }
    };

    METRGUI.prototype.update_frame_list = function(layer) {
        this.anim.selectAll('div.frame').remove();

        var _this = this;
        var frame_times = layer.get_frame_times()
        frame_times.reverse();

        this.anim.select('#framelist')
                 .selectAll('div.frame')
                 .data(frame_times)
                 .enter()
                 .append('div')
                 .classed('frame', true)
                 .classed('active', function(d, i) {
                     return d == _this.layer_container.dt || (i == 0 && _this.layer_container.dt >= d);
                 })
                 .attr('data-time', function(d, i) { return d.toString(); })
                 .html('&#x25cf;')
                 .on('click', function(dt) {
                     d3.selectAll('div.frame').classed('active', false);
                     d3.select(this).classed('active', true);
                     _this.layer_container.update_time(dt);
                 });

        var framelist_rect = this.anim.select('#framelist').node().getBoundingClientRect();
        var play_rect = this.anim.select('#play').node().getBoundingClientRect();

        var anim_width = framelist_rect.width + play_rect.width;
        this.anim.style('left', this.width / this.dpr - anim_width).style('width', anim_width + 'px');
    };

    this.MapPicker = function(map_proj, data, callback) {
        this.map_proj = map_proj;
        this.data = data

        for (var idat in this.data) {
            pt = this.map_proj.map([this.data[idat]['longitude'], this.data[idat]['latitude']]);
            this.data[idat]['x_proj'] = pt[0];
            this.data[idat]['y_proj'] = pt[1];
        }

        d3.select('body')
          .selectAll('div.picker')
          .data(this.data)
          .enter()
          .append('div')
          .attr('class', 'picker')
          .style('position', 'absolute')
          .style('visibility', 'hidden')
          .append('div')
          .text(function(d) { return d['text']; })
          .on('click', function() {
              callback(d3.select(this)); 
          })
    };

    this.MapPicker.prototype.draw = function(zoom_trans) {
        for (var idat in this.data) {
            var pt = zoom_trans.apply([this.data[idat]['x_proj'], this.data[idat]['y_proj']]);
            this.data[idat]['x_pix'] = pt[0];
            this.data[idat]['y_pix'] = pt[1];
        }

        var width = 50;
        var height = 30;

        d3.selectAll('div.picker')
          .data(this.data)
          .style('width', width)
          .style('height', height) 
          .style('left', function(d) { return d['x_pix'] - width / 2; })
          .style('top', function(d) { return d['y_pix'] - height / 2; })
          .style('visibility', 'visible')
          .select('div')
          .style('height', (height - 4))
          .style('line-height', (height - 4) + 'px')
          .each(function(d) {
              if (this.sub_menu !== undefined) {
                  var root_rect = this.getBoundingClientRect();
                  d3.select(this.sub_menu)
                    .style('left', root_rect.right + 3)
                    .style('top', root_rect.top - 2);
              }
          })
    };

    this.MapPicker.prototype.clear = function() {
        d3.selectAll('div.picker').remove();
    }

    this.LayerContainer = function(width) {
        this._draw_order = [];
        this._active_layer = undefined;
        this._width = width;

        var _this = this;
        var menu_adder = function(pos) {
            return function(lyr) {
                lyr.menu_action = this;
                _this.add_layer(lyr, pos);
            }
        };

        this._popup_menu = new Menu({
            'Geography': new Menu({
                'US States': new MenuAction(function() {
                    gui.create_layer(menu_adder(0).bind(this), ShapeLayer, 'geo', 'us_st');
                }),
                'US Counties': new MenuAction(function() {
                    gui.create_layer(menu_adder(0).bind(this), ShapeLayer, 'geo', 'us_cty');
                }),
                'US Interstate Highways': new MenuAction(function() {
                    gui.create_layer(menu_adder(0).bind(this), ShapeLayer, 'geo', 'us_interstate');
                }),
            }),
            'Level 2 Radar': new MenuAction(function(site, field, elev) {
                if (site === undefined || field === undefined || elev === undefined ) {
                    this.available = true;
                    gui.level2_picker(this);
                }
                else {
                    gui.create_layer(menu_adder(-1).bind(this), Level2Layer, site, field, elev);
                }
            }),
            'Observations': new Menu({
                'METAR': new MenuAction(function() {
                    gui.create_layer(menu_adder(0).bind(this), ObsLayer, 'metar');
                }),
                'Mesonet': new MenuAction(function() {
                    gui.create_layer(menu_adder(0).bind(this), ObsLayer, 'mesonet');
                }),
            }),
        }, '165px');

        this._anim_intv = 500; // interval of 0.5 seconds for now
        this.dt = new Date();
        this._mode = 'auto-update';
        this._animating = false;
        this._timer_id = window.setInterval(this.animate.bind(this), this._anim_intv);
    };

    this.LayerContainer.prototype.init = function() {
        var layer_str = utils.get_cookie('layers');

        if (layer_str === undefined) {
            this._popup_menu.tree['Geography'].tree['US States'].perform_action();
            this._popup_menu.tree['Geography'].tree['US Counties'].perform_action();
        }
        else {
            var layers = layer_str.split('|');
            for (ilyr in layers) {
                // Check for arguments that need to be passed to the menu action
                if (layers[ilyr].indexOf(':') >= 0) {
                    var layer_info = layers[ilyr].split(':');
                    var layer_path = layer_info[0];
                    var args = layer_info.slice(1);
                }
                else {
                    var layer_path = layers[ilyr];
                    var args = [];
                }

                // Check for the active layer
                if (layer_path.slice(0, 3) == "[A]") {
                    var active_layer = ilyr;
                    layer_path = layer_path.slice(3);
                }

                var path = layer_path.split('/');

                var menu = this._popup_menu;
                for (ipth in path) {
                    menu = menu.tree[path[ipth]];
                }

                menu.perform_action.apply(menu, args);
                menu.available = false;
            }

            this.activate_layer(this._draw_order[active_layer]);
        }
    };

    this.LayerContainer.prototype.save_to_cookie = function() {
        var layer_strs = [];
        for (var ilyr in this._draw_order) {
            var str = this._popup_menu.path_to_action(this._draw_order[ilyr].menu_action);
            if (this._draw_order[ilyr] instanceof Level2Layer) {
                // TODO: In the future, make this more general
                site = this._draw_order[ilyr].site;
                field = this._draw_order[ilyr].field;
                elev = this._draw_order[ilyr].elev;

                args_str = sprintf(":%s:%s:%.1f", site, field, elev);
                str += args_str;
            }
            if (this._draw_order[ilyr].active) {
                str = "[A]" + str;
            }
            layer_strs.push(str);
        }
        utils.set_cookie('layers', layer_strs.join('|'));
    };

    this.LayerContainer.prototype.draw_layers = function(zoom_matrix, zoom_fac) {
        for (ilyr in this._draw_order) {
            this._draw_order[ilyr].draw(zoom_matrix, zoom_fac);
        }
    };

    this.LayerContainer.prototype.create_layer_menu = function(menu) {
        var _this = this;

        var ul = menu.append('ul');
        for (var ilyr = this._draw_order.length - 1; ilyr > -1; ilyr--) {
            var lyr_html = this._draw_order[ilyr].layer_menu_html();
            var lyr_mkr = ul.append('li').on('click', function() {
                if (d3.event.target.className != 'remove') {
                    _this.activate_layer(_this._layer_from_marker(this)); 
                }
            });
            lyr_mkr.append('div').attr('class', 'drag').text("\u22ee");
            lyr_mkr.append('p').html(lyr_html);
            lyr_mkr.append('div')
                   .attr('class', 'remove')
                   .text('\u00d7')
                   .on('click', function() {
                       _this.remove_layer(_this._layer_from_marker(this.parentNode));
                       gui.draw();
                   });

            if (this._draw_order[ilyr].active) {
                var n_layers = this._draw_order.length;
                var lyr_marker = d3.select(ul.node().childNodes[n_layers - ilyr - 1]);
                lyr_marker.attr('class', 'active');
            }
        }

        var width = parseInt(this._width, 10) - 4;
        ul.selectAll('li').style('width', width + 'px');
        ul.selectAll('li').call(d3.drag().on('start', function() { _this._drag_layers(this); }));

        ul.append('li').html('+').attr('class', 'addnew').on('click', function() {
            var root = d3.select(this).attr('depth', 0);
            gui.remove_map_picker();
            _this._popup_menu.show(root);
        });
    };

    this.LayerContainer.prototype.add_layer = function(lyr, pos) {
        if (pos == -1) {
            this._draw_order.unshift(lyr);
        }
        else {
            this._draw_order.push(lyr);
        }

        this.save_to_cookie();
        this.activate_layer(lyr);
    };

    this.LayerContainer.prototype.remove_layer = function(lyr) {
        var lyr_idx = this._index_of_layer(lyr);
        this._draw_order.splice(lyr_idx, 1);

        lyr.menu_action.available = true;
        lyr.cleanup();

        if (lyr.active) {
            var new_idx = Math.max(lyr_idx - 1, 0);
            this.activate_layer(this._draw_order[new_idx]);
        }

        this.save_to_cookie();
        gui.refresh_menu();
    };

    this.LayerContainer.prototype.activate_layer = function(layer) {
        if (this._active_layer !== undefined) {
            this._active_layer.active = false;
        }

        layer.active = true;
        this._active_layer = layer;

        this.save_to_cookie();
        gui.set_status(layer);
        gui.refresh_menu();
    };

    this.LayerContainer.prototype.set_layer_viewports = function(width, height) {
        for (var ilyr in this._draw_order) {
            this._draw_order[ilyr].set_viewport(width, height);
        }
    };

    this.LayerContainer.prototype.toggle_animation = function() {
        this._animating = !this._animating;

        var layer_times = this._active_layer.get_frame_times();
        if (this.dt.getTime() == layer_times[layer_times.length - 1].getTime()) {
            this._mode = 'auto-update'
        }
        else {
            this._mode = 'animate';
        }
    };

    this.LayerContainer.prototype.animate = function() {
        if (this._mode == 'auto-update') {
            this.dt = new Date();
        }
        else if (this._animating) {
            var layer_times = this._active_layer.get_frame_times();
            var idx = layer_times.map(function(elem) { return elem.getTime(); }).indexOf(this.dt.getTime());
            if (idx >= layer_times.length - 1) {
                this.dt = layer_times[0];

                if (this._timer_id === null) {
                    this._timer_id = window.setInterval(this.animate.bind(this), this._anim_intv);
                }
            }
            else if (idx + 1 >= layer_times.length - 1) {
                this.dt = layer_times[idx + 1];

                window.clearTimeout(this._timer_id);
                this._timer_id = null;
                window.setTimeout(this.animate.bind(this), this._anim_intv * 3);
            }
            else {
                this.dt = layer_times[idx + 1];
            }
            d3.selectAll('div.frame').classed('active', false);
            d3.select('div[data-time="' + this.dt.toString() + '"]').classed('active', true);
        }

        for (var ilyr in this._draw_order) {
            this._draw_order[ilyr].set_time(this.dt);
        }

        gui.set_status(this._active_layer);
        gui.draw();
    };

    this.LayerContainer.prototype.update_time = function(js_dt) {
        this._animating = false;
        if (this._timer_id === null) {
            this._timer_id = window.setInterval(this.animate.bind(this), this._anim_intv);
        }

        var layer_times = this._active_layer.get_frame_times();
        if (js_dt < layer_times[layer_times.length - 1]) {
            this.dt = js_dt;
            this._mode = 'animate';
        }
        else {
            this._mode = 'auto-update';
        }
        this.animate();
    };

    this.LayerContainer.prototype._index_of_layer = function(lyr) {
        var lyr_index = this._draw_order.indexOf(lyr);
        if (lyr_index == -1) {
            throw "Layer not found!";
        }
        return lyr_index;
    };

    this.LayerContainer.prototype._index_of_marker = function(mkr) {
        var n_layers = this._draw_order.length;
        var mkr_index = -1;
        for (var lyr of mkr.parentNode.childNodes.entries()) {
            if (lyr[1] == mkr) {
                mkr_index = lyr[0];
            }
        }

        if (mkr_index == -1) {
            throw "Marker not found!";
        }
        return mkr_index;
    };

    this.LayerContainer.prototype._layer_from_marker = function(mkr) {
        var n_layers = this._draw_order.length;
        var mkr_index = this._index_of_marker(mkr);
        return this._draw_order[n_layers - mkr_index - 1];
    };

    this.LayerContainer.prototype._drag_layers = function(target) {
        if (d3.event.sourceEvent.target.classList.value !== "drag") {
            return;
        }

        var lyr_marker = d3.select(target);
        var lyr_parent = d3.select(target.parentNode);

        var lyr_index = this._index_of_marker(target);
        var lyr_coords = [];
        for (var lyr of target.parentNode.childNodes.entries()) {
            var lyr_rect = lyr[1].getBoundingClientRect();
            if (lyr[1].className != "addnew") {
                lyr_coords[lyr[0]] = (lyr_rect.top + lyr_rect.bottom) / 2;
            }
        }

        var lyr_spacer = d3.select(target.cloneNode(false)).style('visibility', 'hidden').node();
        target.parentNode.insertBefore(lyr_spacer, target.parentNode.childNodes[lyr_index + 1]);

        var mkr_pos = target.getBoundingClientRect();
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
            var mkr_pos = target.getBoundingClientRect();
            if (lyr_index > 0 && mkr_pos.top < lyr_coords[lyr_index - 1]) {
                var swap_node = target.parentNode.childNodes[lyr_index - 1];
                target.parentNode.removeChild(swap_node);
                target.parentNode.insertBefore(swap_node, target.parentNode.childNodes[lyr_index + 1]);

                var n_layers = this._draw_order.length;
                var swap_lyr = this._draw_order[n_layers - (lyr_index - 1) - 1];
                this._draw_order.splice(n_layers - (lyr_index - 1) - 1, 1);
                this._draw_order.splice(n_layers - lyr_index - 1, 0, swap_lyr);
                this.save_to_cookie();
                gui.draw();

                lyr_index--;
            }
            else if (lyr_index < lyr_coords.length - 1 && mkr_pos.bottom > lyr_coords[lyr_index + 1]) {
                var swap_node = target.parentNode.childNodes[lyr_index + 2];
                target.parentNode.removeChild(swap_node);
                target.parentNode.insertBefore(swap_node, target.parentNode.childNodes[lyr_index]);

                var n_layers = this._draw_order.length;
                var swap_lyr = this._draw_order[n_layers - (lyr_index + 1) - 1];
                this._draw_order.splice(n_layers - (lyr_index + 1) - 1, 1);
                this._draw_order.splice(n_layers - (lyr_index) - 1, 0, swap_lyr);
                this.save_to_cookie();
                gui.draw();

                lyr_index++;
            }
        }

        function dragend() {
            target.parentNode.removeChild(lyr_spacer);
            lyr_marker.style('position', 'static');
        }

        d3.event.on('drag', dragged.bind(this)).on('end', dragend.bind(this));
    };

   /********************
    * TimeFrame code
    ********************/
    this.SingleEntityFrameSet = function(callback, max_age) {
        this._callback = callback;
        this._max_age = max_age * 1000;
        this._entities = [];
    };

    this.SingleEntityFrameSet.prototype.add_entity = function(entity) {
        var entity_output = {'valid':entity.valid, 'expires':entity.expires}
        entity_output['resp'] = this._callback(entity);

        this._entities.push(entity_output);
        this._prune_table();
    };

    this.SingleEntityFrameSet.prototype.query = function(js_dt) {
        var valid_entities = [];
        for (var ient in this._entities) {
            var entity = this._entities[ient];
            if (entity.valid <= js_dt && js_dt < entity.expires) {
                valid_entities.push(entity);
            }
        }

        var most_recent = null;
        for (var ient in valid_entities) {
            if (most_recent === null || valid_entities[ient].valid > most_recent.valid) {
                most_recent = valid_entities[ient];
            }
        }

        if (most_recent !== null) {
            most_recent = most_recent['resp'];
        }

        return most_recent;
    };

    this.SingleEntityFrameSet.prototype.get_times = function() {
        var starts = [];
        var end_time = new Date("2018/01/01");
        for (var iintv in this._intv_table) {
            if (this._intv_table[iintv].start >= end_time) {
                end_time = this._intv_table[iintv].start;
            }
        }

        var start_time = end_time - this._max_age;
        for (ient in this._entities) {
            if (this._entities[ient].valid >= start_time) {
                starts.push(this._entities[ient].valid);
            }
        }
        starts.sort(function(a, b) { return a - b; })
        return starts;
    };

    this.SingleEntityFrameSet.prototype._prune_table = function() {
        var kick_out_time = new Date() - this._max_age;
        for (var ient = this._entities.length - 1; ient >= 0; ient--) {
            if (this._entities[ient].expires < kick_out_time) {
                this._entities.splice(ient, 1);
            }
        }
    };

    this.MultiEntityFrameSet = function(reframe_callback, max_age) {
        this._callback = reframe_callback;
        this._max_age = max_age * 1000; // store max_age in milliseconds
        this._entities = [];
        this._intv_table = [];
        this._ent_table = [];

        var Interval = function(start, end) {
            this.start = start;
            this.end = end;
        };

        Interval.prototype.is_empty = function() {
            return this.start.getTime() == this.end.getTime();
        };

        Interval.prototype.equals = function(other) {
            return this.start.getTime() == other.start.getTime() && this.end.getTime() == other.end.getTime();
        };

        Interval.prototype.contains = function(other) {
            return other.start.getTime() >= this.start.getTime() && other.end.getTime() <= this.end.getTime();
        };

        Interval.prototype.contains_time = function(js_dt) {
            return this.start.getTime() <= js_dt.getTime() && js_dt.getTime() <= this.end.getTime();
        };

        Interval.prototype.intersects = function(other) {
            return !this.intersection(other).is_empty();
        };

        Interval.prototype.intersection = function(other) {
            var start = new Date(Math.max(this.start, other.start));
            var end = new Date(Math.min(this.end, other.end));

            if (end < start) { 
                end = start;
            }

            return new Interval(start, end);
        };

        Interval.prototype.reinterval = function(intv_ary) {
            var bounds = [];
            for (iintv in intv_ary) {
                bounds.push(intv_ary[iintv].start, intv_ary[iintv].end);
            }
            bounds.push(this.start, this.end);

            bounds.sort(function(a, b) { return a - b; });
            var new_intervals = [];
            for (var iintv = 0; iintv < bounds.length - 1; iintv++) {
                var new_intv = new Interval(bounds[iintv], bounds[iintv + 1]);
                if (!new_intv.is_empty()) {
                    new_intervals.push(new_intv);
                }
            }
            return new_intervals;

        };

        this.Interval = Interval;
    };

    this.MultiEntityFrameSet.prototype.add_entities = function(entities) {
        this._entities = this._entities.concat(entities);
        this._prune_table();
        this._build_table();
    };

    this.MultiEntityFrameSet.prototype.query = function(js_dt) {
        for (var iintv in this._intv_table) {
            if (this._intv_table[iintv].contains_time(js_dt)) {
                return this._ent_table[iintv];
            }
        }
        return null;
    };

    this.MultiEntityFrameSet.prototype.get_times = function() {
        var starts = [];
        var end_time = new Date("2018/01/01");
        for (var iintv in this._intv_table) {
            if (this._intv_table[iintv].start >= end_time) {
                end_time = this._intv_table[iintv].start;
            }
        }

        start_time - end_time - this._max_age;        

        for (var iintv in this._intv_table) {
            if (this._intv_table[iintv].start >= start_time) {
                starts.push(this._intv_table[iintv].start);
            }
        }

        starts.sort(function(a, b) { return a - b; })
        return starts;
    };

    this.MultiEntityFrameSet.prototype._prune_table = function() {
        var kick_out_time = new Date() - this._max_age;
        for (var ient = this._entities.length - 1; ient >= 0; ient--) {
            if (this._entities[ient].expires < kick_out_time) {
                this._entities.splice(ient, 1);
            }
        }
    };

    this.MultiEntityFrameSet.prototype._build_table = function() {
        // This function needs work.
        this._intv_table = [];
        this._ent_table = [];

        for (var ient in this._entities) {
            var entity = this._entities[ient];
            var entity_intv = new this.Interval(entity.valid, entity.expires);

            if (this._intv_table.length == 0) {
                // If this is the first entity list, just push it onto the table
                this._intv_table.push(entity_intv);
                this._ent_table.push([entity]);
                continue;
            }

            var new_intervals = entity_intv.reinterval(this._intv_table);
            var new_intv_table = [];
            var new_ent_table = [];

            for (var iintv in new_intervals) {
                var intv1 = new_intervals[iintv];
                new_intv_table.push(intv1);
                new_ent_table.push([]);
                var inent = new_ent_table.length - 1;

                for (var jintv in this._intv_table) {
                    var intv2 = this._intv_table[jintv];
                    if (intv2.contains(intv1)) {
                        new_ent_table[inent] = new_ent_table[inent].concat(this._ent_table[jintv]);
                    }
                }

                if (entity_intv.contains(intv1)) {
                    new_ent_table[inent].push(entity);
                }

                if (new_ent_table[inent].length == 0) {
                    new_intv_table.pop();
                    new_ent_table.pop();
                }
            }

            this._intv_table = new_intv_table;
            this._ent_table = new_ent_table;
        }

        for (ient in this._ent_table) {
            this._ent_table[ient] = this._callback(this._ent_table[ient]);
        }
    };

   /********************
    * DataLayer code
    ********************/
    this.DataLayer = function(gl) {
        this._gl = gl;
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

    this.DataLayer.prototype.cleanup = function() {
        io.request({'action': 'deactivate', 'handler': this._layer_id});
    };

    this.DataLayer.prototype.set_time = function(js_dt) {
        this._dt = js_dt;
    };

    this.DataLayer.prototype.get_frame_times = function() {
        return this._frames.get_times();
    };

   /********************
    * ShapeLayer code
    ********************/
    this.ShapeLayer = function(gl, map_proj, max_age, cls, name) {
        this._gl = gl;
        this._map_proj = map_proj;
        this.cls = cls;
        this.name = name;

        if (name == 'us_st') {
            this._thickness = 4.5;
            this._color = [0, 0, 0];
        }
        else if ( name == 'us_interstate') {
            this._thickness = 4.5;
            this._color = [0, 0, 0.4];
        }
        else {
            this._thickness = 1.5;
            this._color = [0, 0, 0];
        }

        function create_polyline(entity_list) {
            var pts = []
            for (var ient = 0; ient < entity_list.length; ient++) {
                var shape = entity_list[ient].shape;
                for (var ipt = 0; ipt < shape.coordinates.length; ipt++) {
                    pts.push(shape.coordinates[ipt]);
                }
                pts.push(NaN, NaN);
            }

            pts.pop(); pts.pop();

            return new PolyLine(this._gl, this._map_proj, [this._vp_width, this._vp_height], pts, this._color, this._thickness);
        }

        this._frames = new _mod.MultiEntityFrameSet(create_polyline.bind(this), max_age);

        this._layer_id = sprintf('shapefile.%s.%s', cls, name);
        io.register_handler(this._layer_id, this.receive_data.bind(this));
        io.request({'action':'activate', 'type':'shapefile', 'domain':cls, 'name':name});
    };

    this.ShapeLayer.prototype = Object.create(this.DataLayer.prototype);
    this.ShapeLayer.prototype.constructor = this.ShapeLayer;

    this.ShapeLayer.prototype.receive_data = function(shp_file) {
        if (shp_file.error !== undefined) {
            console.log('Server error: ' + shp_file.error);
            return;
        }

        this._frames.add_entities(shp_file.entities);
 
        if (this.active) {
            gui.set_status(this);
            gui.update_frame_list(this);
        }

        gui.draw();
    };

    this.ShapeLayer.prototype.set_status = function(status_bar) {
        var names = {'us_cty': 'US County Boundaries', 'us_st': 'US State Boundaries', 'us_interstate':'US Interstate Highways'};
        var stat = names[this.name];

        var stat_rect = status_bar.node().getBoundingClientRect()
        status_bar.html('')
                  .append('p')
                  .style('height', stat_rect.height)
                  .style('line-height', stat_rect.height + 'px')
                  .style('vertical-align', 'middle')
                  .html(stat)
    }

    this.ShapeLayer.prototype.draw = function(zoom_matrix, zoom_fac) {
        polyline = this._frames.query(this._dt);

        if (polyline !== null) {
            polyline.draw(zoom_matrix, zoom_fac);
        }
    };

    this.ShapeLayer.prototype.layer_menu_html = function() {
        var names = {'us_cty':'US Counties', 'us_st':'US States', 'us_interstate':'US Interstate Highways'};
        var readable_name = names[this.name];
        return readable_name;
    };


   /********************
    * Level2Layer code
    ********************/
    this.Level2Layer = function(gl, map_proj, max_age, site, field, elev) {
        var _vert_shader_src = `
            attribute vec2 a_pos;
            attribute vec2 a_tex;
            uniform mat3 u_zoom;
            uniform vec2 u_rdr_pos;

            varying vec2 v_tex;

            void main() {
                vec2 pos_lonlat = lonlat_at(u_rdr_pos, a_pos.x, a_pos.y);
                vec2 pos_px = lcc(pos_lonlat);
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
        var process_radar_data = function(l2_file) {
            var rdr_loc = [l2_file.site_longitude, l2_file.site_latitude];

            var st_rn = l2_file.st_range / 1000;
            var st_az = l2_file.st_azimuth;
            var drng = l2_file.drng / 1000;
            var dazim = l2_file.dazim;
            var tex_size_x = l2_file.n_gates;
            var tex_size_y = l2_file.n_rays;
            var skip_rng = l2_file.n_gates / 8;
            var skip_az = 1;

            var ipt = 0;
            var pts = [];
            var tex_coords = [];
            for (var iaz = 0; iaz < l2_file.n_rays + 1; iaz += skip_az) {
                for (var irn = 0; irn < l2_file.n_gates + 1; irn += skip_rng) {
                    pts[ipt + 0] = (st_rn + (irn - 0.5) * drng);
                    pts[ipt + 1] = (st_az + (iaz - 0.5) * dazim);

                    tex_coords[ipt + 0] = irn / tex_size_x;
                    tex_coords[ipt + 1] = iaz / tex_size_y;

                    ipt += 2;
                }
            }

            var refl_img = [];
            var ipt = 0;
            l2_file.data = new Float32Array(l2_file.data.buffer);
            for (var iaz = 0; iaz < tex_size_y; iaz++) {
                for (var irn = 0; irn < tex_size_x; irn++) {
                    var igt = l2_file.n_gates * iaz + irn;
                    var color = this.color_maps[this.field].cmap(l2_file.data[igt]);
                    refl_img[ipt + 0] = color[0];
                    refl_img[ipt + 1] = color[1];
                    refl_img[ipt + 2] = color[2];
                    refl_img[ipt + 3] = color[3];
                    ipt += 4;
                }
            }

            idxs = [];
            var ipt = 0;
            for (var iaz = 0; iaz < l2_file.n_rays / skip_az; iaz++) { 
                for (var irn = 0; irn < (l2_file.n_gates + 1) / skip_rng; irn++) {
                    var idx = (Math.floor((l2_file.n_gates + 1) / skip_rng) + 1) * iaz + irn;
                    if (irn == 0 && iaz > 0) { 
                        idxs[ipt - 1] = idx;
                    }

                    idxs[ipt + 0] = idx;
                    idxs[ipt + 1] = idx + Math.floor((l2_file.n_gates + 1) / skip_rng) + 1;
                    ipt += 2;
                }

                if (iaz < l2_file.n_rays / skip_az) {
                    idxs[ipt] = idxs[ipt - 1];
                    ipt += 2;
                }
            }

            return {'timestamp': l2_file.valid, 'rdrloc': rdr_loc, 'pts': new Float32Array(pts), 'idxs': new Uint16Array(idxs),
                    'tex_coords': new Float32Array(tex_coords), 'tex_info': {'sizex':tex_size_x, 'sizey':tex_size_y, 'image':new Uint8Array(refl_img)}};
        };

        this.site = site;
        this.field = field;
        this.elev = parseFloat(elev);

        this._frames = new _mod.SingleEntityFrameSet(process_radar_data.bind(this), max_age);

        var _default_units = {'REF': 'dBZ', 'VEL': 'm/s'};
        this.units = _default_units[this.field];

        this._shader = new WGLShader(gl, 'level2', _vert_shader_src, _frag_shader_src);
        this._shader.register_plugin(map_proj);
        this._shader.register_plugin(new geo.geodesic());
        this._shader.compile_program();

        this._shader.register_attribute('a_pos');
        this._shader.register_attribute('a_tex');
        this._shader.register_uniform('mat3', 'u_zoom');
        this._shader.register_uniform('vec2', 'u_rdr_pos');
        this._shader.register_index_array();

        var int_deg = Math.floor(this.elev);
        var frc_deg = Math.round((this.elev - int_deg) * 10);
        this._layer_id = sprintf("level2radar.%s.%s.%02dp%1d", site, field, int_deg, frc_deg);
        io.register_handler(this._layer_id, this.receive_data.bind(this));
        io.request({'action':'activate', 'type':'level2radar', 'site':site, 'field':field, 'elev':this.elev});
    };

    this.Level2Layer.prototype = Object.create(this.DataLayer.prototype);
    this.Level2Layer.prototype.constructor = this.Level2Layer;

    this.Level2Layer.prototype.receive_data = function(l2_file) {
        if (l2_file.error !== undefined) {
            console.log('Server error: ' + l2_file.error);
            return;
        }

        this._frames.add_entity(l2_file.entities[0]);

        if (this.active) {
            gui.set_status(this);
            gui.update_frame_list(this);
        }
        gui.draw();
    };

    this.Level2Layer.prototype.set_status = function(status_bar) {
        var l2obj = this._frames.query(this._dt);
        if (l2obj !== null) {
            var time_fmt = d3.utcFormat("%H%M UTC %d %b %Y");
            var time_str = time_fmt(l2obj.timestamp)
            var stat = sprintf("%s %.1f\u00b0 %s (%s)", this.site, this.elev, this.field, time_str);
        }
        else {
            var stat = sprintf("Downloading %s data ...", this.site);
        }

        var stat_rect = status_bar.node().getBoundingClientRect()
        status_bar.html('')
                  .append('p')
                  .style('height', stat_rect.height)
                  .style('line-height', stat_rect.height + 'px')
                  .style('vertical-align', 'middle')
                  .style('float', 'left')
                  .html(stat);

        var color_bar = status_bar.append('div')
                                  .style('float', 'right')

        var color_map = this.color_maps[this.field];
        color_map.create_colorbar(color_bar, this.units);
    }

    this.Level2Layer.prototype.draw = function(zoom_matrix, zoom_fac) {
        var l2obj = this._frames.query(this._dt);
        if (l2obj === null) {
            return;
        }

        var gl = this._gl;

        this._shader.enable_program();
        this._shader.register_texture('radar', 'u_tex', l2obj.tex_info);
        this._shader.bind_attribute('a_pos', l2obj.pts);
        this._shader.bind_attribute('a_tex', l2obj.tex_coords);
        this._shader.bind_uniform('u_zoom', zoom_matrix, true);
        this._shader.bind_uniform('u_rdr_pos', l2obj.rdrloc);
        this._shader.bind_texture('radar', 0);
        this._shader.bind_index_array(l2obj.idxs);

        gl.drawElements(gl.TRIANGLE_STRIP, l2obj.idxs.length, gl.UNSIGNED_SHORT, 0);
    };

    this.Level2Layer.prototype.layer_menu_html = function() {
        var readable_name = sprintf("%s %.1f\u00b0 %s", this.site, this.elev, this.field);
        return readable_name;
    };

    this.ColorMap = function(levels, colors, tick_spacing, tick_fmt) {
        this.levels = levels;
        this.colors = colors;
        this._tick_spacing = tick_spacing;
        this._tick_fmt = tick_fmt;
        if (this._tick_fmt === undefined) { this._tick_fmt = "%d"; }

        this.interps = [];
        for (var ilv = 0; ilv < colors.length - 1; ilv++) {
            var color1 = "rgba(" + colors[ilv].slice(0, 3).join(',') + ',' + (colors[ilv][3] / 255) + ')'
            var color2 = "rgba(" + colors[ilv + 1].slice(0, 3).join(',') + ',' + (colors[ilv + 1][3] / 255) + ')'
            var interp = d3.interpolateLab(color1, color2);
            this.interps.push(interp);
        }
    };

    this.ColorMap.prototype.cmap = function(level) {
        var color = [0, 0, 0, 0];
        for (var ilv = 0; ilv < this.levels.length - 1; ilv++) {
            if (this.levels[ilv] <= level && level < this.levels[ilv + 1]) {
                var frac = (level - this.levels[ilv]) / (this.levels[ilv + 1] - this.levels[ilv]);
                d3_color = d3.rgb(this.interps[ilv](frac));
                color = [d3_color.r, d3_color.g, d3_color.b, 255];
                break
            }
        }
        return color;
    };

    this.ColorMap.prototype.create_colorbar = function(root, units) {
        var cb_elem_width = 35
        var stat_rect = root.node().getBoundingClientRect()

        var colors = [];
        for (var icl = 0; icl < this.colors.length - 1; icl++) {
            colors.push({'c1':this.colors[icl], 'c2':this.colors[icl + 1], 'l1':this.levels[icl], 'l2':this.levels[icl + 1]});
        }
        var ticks = [];
        for (var ilv = this.levels[0]; ilv <= this.levels[this.levels.length - 1]; ilv += this._tick_spacing) {
            ticks.push(sprintf(this._tick_fmt, ilv));
        }

        var _this = this;

        root.append('ul')
            .style('height', stat_rect.height / 2 - 1)
            .style('padding-left', cb_elem_width / 2)
            .selectAll('li')
            .data(colors)
            .enter()
            .append('li')
            .style('background', function(d) { return 'linear-gradient(to right, rgba(' + d.c1.join() + '), rgba(' + d.c2.join() + '))'; })
            .style('display', 'inline-block')
            .style('width', function(d) { return ((d.l2 - d.l1) / _this._tick_spacing * cb_elem_width) + 'px'; })
            .style('height', (stat_rect.height / 2 - 1) + 'px')
            .html('&nbsp;');

        root.append('ul')
            .style('font-size', (stat_rect.height / 2 - 1) + 'px')
            .selectAll('li')
            .data(ticks.concat([units]))
            .enter()
            .append('li')
            .style('display', 'inline-block')
            .style('width', cb_elem_width + 'px')
            .style('text-align', 'center')
            .text(function(d) { return d; });

    };

    this.Level2Layer.prototype.color_maps = {
        'REF': new this.ColorMap(
            [-10 ,               5,                    20,
             35,                 40,                   45,                   50,
             55,                 60,                   65,                   75,                   80],
            [[151, 151, 151, 255], [0,   118, 236, 255], [0,   200, 0,   255],
             [243, 243, 0,   255], [243, 192, 0,   255], [255, 144, 0,   255], [255, 0,   0,   255], [214, 0,   0,   255],
             [192, 0,   0,   255], [255, 0,   255, 255], [153, 85,  201, 255], [255, 255, 255, 255]],
            5
        ),
        'VEL': new this.ColorMap(
            [-70, -35,             -5,                0,                  5,                  35,              70],
            [[0, 102, 255, 255], [0, 255, 221, 255], [0, 114, 102, 255], [136, 136, 136, 255], [136, 0, 0, 255], [255, 0, 0, 255], [255, 204, 0, 255]],
            10
        ),
        'CCR': new this.ColorMap(
            [0.0, 0.5, 0.7, 0.9, 1.0],
            [[243, 0,   0,   255], [243, 0,   0,   255], [243, 243, 0,   255], [0,   203, 0,   255], [119, 119, 119, 255]],
            0.1, "%.1f"
        )
    };


   /********************
    * ObsLayer code
    ********************/
    this.ObsLayer = function(gl, map_proj, max_age, source) {
        var _text_vert_shader_src = `
            attribute vec2 a_pos;
            attribute vec2 a_anch;
            attribute vec2 a_tex;
            uniform mat3 u_zoom;
            uniform vec2 u_viewport;

            varying vec2 v_tex;

            void main() {
                vec2 proj_pos = lcc(a_anch);
                vec2 zoom_anch_pos = (vec3(proj_pos, 1.0) * u_zoom).xy;
                vec2 zoom_pos = zoom_anch_pos + a_pos / u_viewport;
                gl_Position = vec4(zoom_pos * 2.0, 0.0, 1.0);

                v_tex = a_tex;
            }
        `;

        var _barb_vert_shader_src = `
            attribute vec2 a_pos;
            attribute vec2 a_anch;
            attribute vec2 a_tex;
            uniform mat3 u_zoom;
            uniform vec2 u_viewport;

            varying vec2 v_tex;

            void main() {
                vec2 proj_pos = lcc(a_anch);
                vec2 rot_pos = rotate_vec(a_pos, a_anch);
                vec2 zoom_anch_pos = (vec3(proj_pos, 1.0) * u_zoom).xy;
                vec2 zoom_pos = zoom_anch_pos + rot_pos / u_viewport;
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
        this._n_bytes = 36;
        this._obs_file = undefined;
        this._dpr = window.devicePixelRatio || 1;

        this._font_shader = new WGLShader(gl, 'font', _text_vert_shader_src, _frag_shader_src);
        this._font_shader.register_plugin(map_proj);
        this._font_shader.register_plugin(new geo.geodesic());
        this._font_shader.compile_program();

        this._font_shader.register_attribute('a_pos');
        this._font_shader.register_attribute('a_anch');
        this._font_shader.register_attribute('a_tex');
        this._font_shader.register_uniform('vec3', 'u_fontcolor');
        this._font_shader.register_uniform('mat3', 'u_zoom');
        this._font_shader.register_uniform('vec2', 'u_viewport');
        this._font_shader.register_texture('font', 'u_tex', _mod.font_atlas.get_texture(), true);

        this._barb_shader = new WGLShader(gl, 'barb', _barb_vert_shader_src, _frag_shader_src);
        this._barb_shader.register_plugin(map_proj);
        this._barb_shader.register_plugin(new geo.geodesic());
        this._barb_shader.compile_program();

        this._barb_shader.register_attribute('a_pos');
        this._barb_shader.register_attribute('a_anch');
        this._barb_shader.register_attribute('a_tex');
        this._barb_shader.register_uniform('vec3', 'u_fontcolor');
        this._barb_shader.register_uniform('mat3', 'u_zoom');
        this._barb_shader.register_uniform('vec2', 'u_viewport');
        this._barb_shader.register_texture('wind_barb', 'u_tex', {'sizex':1, 'sizey':1, 'image':new Uint8Array([255, 255, 255, 255])});

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

        function process_obs(entities) {
            var text_info = {};
            for (var obvar in this._text_from_ob) {
                text_info[obvar] = {'anch': [], 'vert': [], 'tex': []};
            }
            var barb_info = {'anch': [], 'vert': [], 'tex': []};

            var valid_time = new Date("2010/01/01");
            for (var ient in entities) {
                if (entities[ient].valid > valid_time) {
                    valid_time = entities[ient].valid;
                }
            }

            var ob_ids = [];

            for (var ient in entities) {
                if (entities[ient].valid < valid_time) {
                    continue;
                }
                var obs_data = entities[ient].data
                var n_obs = obs_data.length / this._n_bytes;

                for (var iob = 0; iob < n_obs; iob++) {
                    var ob_buf = obs_data.slice(iob * this._n_bytes, (iob + 1) * this._n_bytes);
                    var ob = {};

                    var id = [];
                    for (var ibyte = 0; ibyte < 5; ibyte++) { id.push(String.fromCharCode(ob_buf[ibyte])); }
                    ob.id = id.join("");
                    if (!ob_ids.includes(ob.id)) {
                        ob_ids.push(ob.id);

                        var sec1 = new Float32Array(ob_buf.slice(8, 36).buffer);

                        ob.latitude    = sec1[0];
                        ob.longitude   = sec1[1];
                        ob.pressure    = sec1[2];
                        ob.temperature = sec1[3];
                        ob.dewpoint    = sec1[4];
                        ob.wind_dir    = sec1[5];
                        ob.wind_spd    = sec1[6];

                        for (var obvar in this._text_from_ob) {
                            var coords = _mod.font_atlas.gen_str(this._text_from_ob[obvar](ob), [ob.longitude, ob.latitude], 12, 
                                                                 this._text_fmt[obvar]['align_h'], this._text_fmt[obvar]['align_v'], this._dpr);
                            for (var txti in coords) {
                                text_info[obvar][txti].push(coords[txti]);
                            }
                        }
                        var coords = this._gen_wind_barb([ob.longitude, ob.latitude], ob.wind_spd, ob.wind_dir);
                        for (var brbi in coords) {
                            barb_info[brbi].push(coords[brbi]);
                        }
                    }
                }
            }

            for (var obvar in text_info) {
                for (var txti in text_info[obvar]) {
                    text_info[obvar][txti] = new Float32Array([].concat.apply([], text_info[obvar][txti]));
                }
            }
            for (var brbi in barb_info) {
                barb_info[brbi] = new Float32Array([].concat.apply([], barb_info[brbi]));
            }

            return {'timestamp': valid_time, 'barb_info': barb_info, 'text_info': text_info}
        }

        this._frames = new MultiEntityFrameSet(process_obs.bind(this), max_age);
        this._layer_id = 'obs.' + this.source;
        io.register_handler(this._layer_id, this.receive_data.bind(this));
        io.request({'action':'activate', 'type':'obs', 'source':this.source});
    };

    this.ObsLayer.prototype = Object.create(this.DataLayer.prototype);
    this.ObsLayer.prototype.constructor = this.ObsLayer;

    this.ObsLayer.prototype.receive_data = function(obs) {
        if (obs.error !== undefined) {
            console.log('Server error: ' + obs.error);
            return;
        }

        this._frames.add_entities(obs.entities);
        console.log(this._frames._intv_table);

        if (this.active) {
            gui.set_status(this);
            gui.update_frame_list(this);
        }
        gui.draw();
    };

    this.ObsLayer.prototype.set_status = function(status_bar) {
        var obs_obj = this._frames.query(this._dt);
        var names = {'metar':'METAR', 'mesonet':'Mesonet'};
        if (obs_obj !== null) {
            var time_fmt = d3.utcFormat("%H%M UTC %d %b %Y");
            var time_str = time_fmt(obs_obj.timestamp)
            var stat = sprintf("%s Station Plots (%s)", names[this.source], time_str);
        }
        else {
            var stat = sprintf("Downloading %s data ...", names[this.source]);
        }

        var stat_rect = status_bar.node().getBoundingClientRect()
        status_bar.html('')
                  .append('p')
                  .style('height', stat_rect.height)
                  .style('line-height', stat_rect.height + 'px')
                  .style('vertical-align', 'middle')
                  .html(stat)
    };

    this.ObsLayer.prototype.draw = function(zoom_matrix, zoom_fac) {
        var obs_obj = this._frames.query(this._dt);
        if (obs_obj === null) {
            return;
        }

        var gl = this._gl;

        this._barb_shader.enable_program();
        this._barb_shader.bind_attribute('a_pos', obs_obj.barb_info['vert']);
        this._barb_shader.bind_attribute('a_anch', obs_obj.barb_info['anch']);
        this._barb_shader.bind_attribute('a_tex', obs_obj.barb_info['tex']);
        this._barb_shader.bind_uniform('u_zoom', zoom_matrix, true);
        this._barb_shader.bind_uniform('u_viewport', [this._vp_width, this._vp_height]);
        this._barb_shader.bind_uniform('u_fontcolor', [0, 0, 0]);
        this._barb_shader.bind_texture('wind_barb', 2);

        gl.drawArrays(gl.TRIANGLES, 0, obs_obj.barb_info['vert'].length / 2);

        this._font_shader.enable_program();
        this._font_shader.bind_texture('font', 1);
        this._font_shader.bind_uniform('u_zoom', zoom_matrix, true);
        this._font_shader.bind_uniform('u_viewport', [this._vp_width, this._vp_height]);

        for (var obvar in obs_obj.text_info) {
            var color = this._text_fmt[obvar]['color'];
            this._font_shader.bind_uniform('u_fontcolor', color);
            this._font_shader.bind_attribute('a_pos', obs_obj.text_info[obvar]['vert']);
            this._font_shader.bind_attribute('a_anch', obs_obj.text_info[obvar]['anch']);
            this._font_shader.bind_attribute('a_tex', obs_obj.text_info[obvar]['tex']);

            gl.drawArrays(gl.TRIANGLES, 0, obs_obj.text_info[obvar]['vert'].length / 2);
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

        var staff_length = 40 * this._dpr;
        var line_width = 1.5 * this._dpr;
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

    this.FontAtlas.prototype.gen_str = function(str, pos, str_hgt, align_h, align_v, dpr) {
        if (align_h === undefined) { align_h = 'left'; }
        if (align_v === undefined) { align_v = 'top'; }
        if (dpr === undefined) { dpr = 1; }

        var chars = str.split('');
        var verts = [];
        var tex_coords = [];
        var anchs = [];
        var str_wid = 0;
        for (ichr in chars) {
            var kerning;
            if (ichr > 0) {
                var char_combo = chars[ichr - 1] + chars[ichr];
                if (char_combo in this._atlas['kerning']) {
                    kerning = this._atlas['kerning'][char_combo];
                }
                else {
                    kerning = 0;
                }
            }
            else {
                kerning = 0;
            }

            var coords = this.gen_char(chars[ichr], str_hgt * dpr);
            for (icd in coords.vert) {
                if (!(icd % 2)) { coords.vert[icd] += str_wid + kerning; }
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

        var offset = 3 * dpr;

        var align_fac_h = -offset;
        var align_fac_v = -offset;
        if (align_h == 'right') {
            align_fac_h = str_wid + offset;
        }
        else if (align_h == 'center') {
            align_fac_h = str_wid / 2;
        }

        if (align_v == 'bottom') {
            align_fac_v = str_hgt * dpr + offset;
        }
        else if (align_v == 'center') {
            align_fac_v = str_hgt * dpr / 2;
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

   /********************
    * PolyLine code
    ********************/
    this.PolyLine = function(gl, map_proj, viewport, pts, color, thickness) {
        var pts_next = pts.slice(2);
        pts_next.push(pts[pts.length - 2], pts[pts.length - 1]);
        var pts_prev = pts.slice(0, pts.length - 2);
        pts_prev.unshift(pts[0], pts[1]);

        for (var ipt = 0; ipt < pts.length; ipt += 2) {
            if (isNaN(pts_next[ipt]) || isNaN(pts_next[ipt + 1])) {
                pts_next[ipt] = pts[ipt];
                pts_next[ipt + 1] = pts[ipt + 1];
            }
            if (isNaN(pts_prev[ipt]) || isNaN(pts_prev[ipt + 1])) {
                pts_prev[ipt] = pts[ipt];
                pts_prev[ipt + 1] = pts[ipt + 1];
            }
            if (isNaN(pts[ipt]) || isNaN(pts[ipt + 1])) {
                pts_prev[ipt] = NaN;
                pts_prev[ipt + 1] = NaN;
                pts_next[ipt] = NaN;
                pts_next[ipt + 1] = NaN;
            }
        }

        this._pts = []
        this._pts_next = [];
        this._pts_prev = [];
        for (var ipt = 0; ipt < pts.length; ipt += 2) {
            if (isNaN(pts[ipt]) || isNaN(pts[ipt + 1])) {
                this._pts.push(pts[ipt - 2], pts[ipt - 1], pts[ipt + 2], pts[ipt + 3]);
                this._pts_next.push(pts_prev[ipt - 2], pts_prev[ipt - 1], pts_next[ipt + 2], pts_next[ipt + 3]);
                this._pts_prev.push(pts_next[ipt - 2], pts_next[ipt - 1], pts_prev[ipt + 2], pts_prev[ipt + 3]);
            }
            else {
                this._pts.push(pts[ipt], pts[ipt + 1], pts[ipt], pts[ipt + 1]);
                this._pts_next.push(pts_next[ipt], pts_next[ipt + 1], pts_prev[ipt], pts_prev[ipt + 1]);
                this._pts_prev.push(pts_prev[ipt], pts_prev[ipt + 1], pts_next[ipt], pts_next[ipt + 1]);
            }
        }

        this._pts = new Float32Array(this._pts);
        this._pts_prev = new Float32Array(this._pts_prev);
        this._pts_next = new Float32Array(this._pts_next);

        this._color = color;
        this._thick = thickness;

        var _vert_shader_src = `
            precision mediump float;
            attribute vec2 a_pos;
            attribute vec2 a_prev;
            attribute vec2 a_next;
            uniform float u_thickness;
            uniform mat3 u_zoom;
            uniform vec2 u_viewport;

            void main() {
                vec2 proj_prev = (vec3(lcc(a_prev), 1.0) * u_zoom).xy;
                vec2 proj_pos = (vec3(lcc(a_pos), 1.0) * u_zoom).xy;
                vec2 proj_next = (vec3(lcc(a_next), 1.0) * u_zoom).xy;

                vec2 dir = vec2(0.0, 0.0);
                if (proj_prev == proj_pos) {
                    dir = normalize(proj_next - proj_pos);
                }
                else if (proj_next == proj_pos) {
                    dir = normalize(proj_pos - proj_prev);
                }
                else {
                    dir = normalize(proj_next - proj_prev);
                }

                float len = u_thickness;

                vec2 normal = vec2(-dir.y, dir.x) / u_viewport;
                vec2 zoom_pos = proj_pos + normal * len / 2.0;
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
        this._viewport = viewport;

        this._shader = new WGLShader(gl, 'polyline', _vert_shader_src, _frag_shader_src);
        this._shader.register_plugin(map_proj);
        this._shader.register_plugin(new geo.geodesic());
        this._shader.compile_program();

        this._shader.register_attribute('a_prev');
        this._shader.register_attribute('a_pos');
        this._shader.register_attribute('a_next');
        this._shader.register_uniform('mat3', 'u_zoom');
        this._shader.register_uniform('vec2', 'u_delta');
        this._shader.register_uniform('float', 'u_thickness');
        this._shader.register_uniform('vec2', 'u_viewport');
        this._shader.register_uniform('vec3', 'u_color');
    }

    this.PolyLine.prototype.draw = function(zoom_matrix, zoom_fac) {
        this._shader.enable_program();
        this._shader.bind_uniform('u_zoom', zoom_matrix, true);
        this._shader.bind_uniform('u_color', this._color);
        this._shader.bind_uniform('u_thickness', this._thick);
        this._shader.bind_uniform('u_viewport', this._viewport);

        this._shader.bind_attribute('a_prev', this._pts_prev);
        this._shader.bind_attribute('a_pos', this._pts);
        this._shader.bind_attribute('a_next', this._pts_next);

        this._gl.drawArrays(this._gl.TRIANGLE_STRIP, 0, this._pts.length / 2);
    }

   /********************
    * Shader manager code
    ********************/
    this.WGLShader = function(gl, name, vert_shader_src, frag_shader_src) {
        this.gl = gl;
        this.name = name;
        this._vs_src = vert_shader_src;
        this._fs_src = frag_shader_src;

        this._tex = {};
        this._tex_unis = {};
        this._attrs = {};
        this._attr_bufs = {};
        this._uniforms = {};
        this._uni_types = {};

        this._plugins = [];
    };

    this.WGLShader.prototype.enable_program = function() {
        this.gl.useProgram(this._prog);

        for (var ipl in this._plugins) {
            this._plugins[ipl].setup_render(this);
        }
    };

    this.WGLShader.prototype.compile_program = function() {
        this._prog = this._compile_shaders(this._vs_src, this._fs_src);

        for (var ipl in this._plugins) {
            this._plugins[ipl].setup_shader(this);
        }
    };

    this.WGLShader.prototype.register_plugin = function(plugin) {
        this._plugins.push(plugin);

        this._vs_src = plugin.shader() + this._vs_src;
    };

    this.WGLShader.prototype.register_texture = function(tex_name, uni_name, tex_data, gen_mipmap) {
        if (gen_mipmap === undefined) { gen_mipmap = false; }

        var gl = this.gl;
        this.register_uniform('sampler2D', uni_name);

        this._tex_unis[tex_name] = uni_name;
        this._tex[tex_name] = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this._tex[tex_name]);
        if (gen_mipmap) {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        }
        else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        if (tex_data['sizex'] !== undefined) {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tex_data['sizex'], tex_data['sizey'], 0, gl.RGBA, 
                          gl.UNSIGNED_BYTE, tex_data['image']);
        }
        else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex_data);
        }

        if (gen_mipmap) {
            gl.generateMipmap(gl.TEXTURE_2D);
        }
    };

    // Eventually would like to be able to parse this from the code itself
    this.WGLShader.prototype.register_attribute = function(attr_name) {
        this._attrs[attr_name] = this.gl.getAttribLocation(this._prog, attr_name);
        this._attr_bufs[attr_name] = this.gl.createBuffer();
    };

    this.WGLShader.prototype.register_uniform = function(uni_type, uni_name) {
        this._uniforms[uni_name] = this.gl.getUniformLocation(this._prog, uni_name);
        this._uni_types[uni_name] = uni_type;
    };

    this.WGLShader.prototype.register_index_array = function(){
        this._idx_ary = this.gl.createBuffer();
    }

    this.WGLShader.prototype.bind_texture = function(tex_name, tex_num) {
        var gl = this.gl;

        this.bind_uniform(this._tex_unis[tex_name], tex_num);
        gl.activeTexture(eval('gl.TEXTURE' + tex_num));
        gl.bindTexture(gl.TEXTURE_2D, this._tex[tex_name]);
    };

    this.WGLShader.prototype.bind_attribute = function(attr_name, attr_data) {
        var gl = this.gl;

        gl.enableVertexAttribArray(this._attrs[attr_name]);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._attr_bufs[attr_name]);
        gl.vertexAttribPointer(this._attrs[attr_name], 2, gl.FLOAT, false, 0, 0);
        gl.bufferData(gl.ARRAY_BUFFER, attr_data, gl.DYNAMIC_DRAW);
    };

    this.WGLShader.prototype.bind_uniform = function(uni_name, uni_data, is_matrix) {
        if (is_matrix === undefined) { is_matrix = false; }

        var call_type, call_num;

        var uni_type = this._uni_types[uni_name];
        if (uni_type == 'int' || uni_type.slice(0, 4) == 'ivec' || uni_type == 'sampler2D') {
            call_type = 'i';
        }
        else {
            call_type = 'f';
        }

        if (Array.isArray(uni_data)) {
            if (is_matrix) {
                call_num = Math.floor(Math.sqrt(uni_data.length));
            }
            else {
                call_num = uni_data.length;
            }
        }
        else {
            uni_data = [ uni_data ];
            call_num = 1;
        }

        var gl_func;

        if (is_matrix) {
            gl_func = eval('this.gl.uniformMatrix' + call_num + call_type + 'v');
            gl_func.bind(this.gl)(this._uniforms[uni_name], false, uni_data);
        }
        else {
            gl_func = eval('this.gl.uniform' + call_num + call_type + 'v');
            gl_func.bind(this.gl)(this._uniforms[uni_name], uni_data);
        }
    };

    this.WGLShader.prototype.bind_index_array = function(idx_ary) {
        var gl = this.gl;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._idx_ary);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx_ary, gl.DYNAMIC_DRAW);
    };

    this.WGLShader.prototype._compile_shaders = function(vert_shader_src, frag_shader_src) {
        var gl = this.gl;

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

    var gui = new METRGUI(); 

    return gui;
})
