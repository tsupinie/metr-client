
define(['sprintf'], function(sprintf) {
    var sprintf = sprintf.sprintf;

    var utils = function() {
        _this = this;

        this.set_cookie = function(cook, value, expire) {
            if (expire === undefined) { expire = false; }

            var expire_dt = new Date();
            
            if (expire) {
                var expire_year = expire_dt.getFullYear() - 1;
            }
            else {
                var expire_year = expire_dt.getFullYear() + 10
            }
            expire_dt.setFullYear(expire_year);

            var cookie_str = sprintf("%s=%s; expires=%s; path=/", cook, value, expire_dt.toUTCString());
            document.cookie = cookie_str;
        };

        this.get_cookie = function(cook) {
            var decoded_cookie = decodeURIComponent(document.cookie);
            var cookie_list = decoded_cookie.split(';');
            for (icook in cookie_list) {
                var cookie_str = cookie_list[icook];
                var crumbs = cookie_str.split('=');
                if (crumbs[0].trim() == cook) {
                    return crumbs[1];
                }
            }
            return undefined;
        };

        this.delete_cookie = function(cook) {
            _this.set_cookie(cook, "", true);
        };
    };

    return new utils()
})
