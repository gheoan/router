System.register(["aurelia-route-recognizer", "aurelia-path", "./navigation-context", "./navigation-instruction", "./router-configuration", "./util"], function (_export) {
  "use strict";

  var RouteRecognizer, join, NavigationContext, NavigationInstruction, RouterConfiguration, processPotential, Router;
  return {
    setters: [function (_aureliaRouteRecognizer) {
      RouteRecognizer = _aureliaRouteRecognizer.RouteRecognizer;
    }, function (_aureliaPath) {
      join = _aureliaPath.join;
    }, function (_navigationContext) {
      NavigationContext = _navigationContext.NavigationContext;
    }, function (_navigationInstruction) {
      NavigationInstruction = _navigationInstruction.NavigationInstruction;
    }, function (_routerConfiguration) {
      RouterConfiguration = _routerConfiguration.RouterConfiguration;
    }, function (_util) {
      processPotential = _util.processPotential;
    }],
    execute: function () {
      Router = function Router(container, history) {
        this.container = container;
        this.history = history;
        this.viewPorts = {};
        this.reset();
        this.baseUrl = "";
      };

      Router.prototype.registerViewPort = function (viewPort, name) {
        name = name || "default";
        this.viewPorts[name] = viewPort;
      };

      Router.prototype.refreshBaseUrl = function () {
        if (this.parent) {
          var baseUrl = this.parent.currentInstruction.getBaseUrl();
          this.baseUrl = this.parent.baseUrl + baseUrl;
        }
      };

      Router.prototype.refreshNavigation = function () {
        var nav = this.navigation;

        for (var i = 0, length = nav.length; i < length; i++) {
          var current = nav[i];

          if (!this.history._hasPushState) {
            if (this.baseUrl[0] == "/") {
              current.href = "#" + this.baseUrl;
            } else {
              current.href = "#/" + this.baseUrl;
            }
          }

          if (current.href[current.href.length - 1] != "/") {
            current.href += "/";
          }

          current.href += current.relativeHref;
        }
      };

      Router.prototype.configure = function (callbackOrConfig) {
        if (typeof callbackOrConfig == "function") {
          var config = new RouterConfiguration();
          callbackOrConfig(config);
          config.exportToRouter(this);
        } else {
          callbackOrConfig.exportToRouter(this);
        }

        return this;
      };

      Router.prototype.navigate = function (fragment, options) {
        fragment = join(this.baseUrl, fragment);
        return this.history.navigate(fragment, options);
      };

      Router.prototype.navigateBack = function () {
        this.history.navigateBack();
      };

      Router.prototype.createChild = function (container) {
        var childRouter = new Router(container || this.container.createChild(), this.history);
        childRouter.parent = this;
        return childRouter;
      };

      Router.prototype.createNavigationInstruction = function () {
        var url = arguments[0] === undefined ? "" : arguments[0];
        var parentInstruction = arguments[1] === undefined ? null : arguments[1];
        var results = this.recognizer.recognize(url);
        var fragment, queryIndex, queryString;

        if (!results || !results.length) {
          results = this.childRecognizer.recognize(url);
        }

        fragment = url;
        queryIndex = fragment.indexOf("?");

        if (queryIndex != -1) {
          fragment = url.substr(0, queryIndex);
          queryString = url.substr(queryIndex + 1);
        }

        if ((!results || !results.length) && this.catchAllHandler) {
          results = [{
            config: {
              navModel: {}
            },
            handler: this.catchAllHandler,
            params: {
              path: fragment
            }
          }];
        }

        if (results && results.length) {
          var first = results[0], fragment = url, queryIndex = fragment.indexOf("?"), queryString;

          if (queryIndex != -1) {
            fragment = url.substr(0, queryIndex);
            queryString = url.substr(queryIndex + 1);
          }

          var instruction = new NavigationInstruction(fragment, queryString, first.params, first.queryParams, first.config || first.handler, parentInstruction);

          if (typeof first.handler == "function") {
            return first.handler(instruction).then(function (instruction) {
              if (!("viewPorts" in instruction.config)) {
                instruction.config.viewPorts = {
                  "default": {
                    moduleId: instruction.config.moduleId
                  }
                };
              }

              return instruction;
            });
          }

          return Promise.resolve(instruction);
        } else {
          return Promise.reject(new Error("Route Not Found: " + url));
        }
      };

      Router.prototype.createNavigationContext = function (instruction) {
        return new NavigationContext(this, instruction);
      };

      Router.prototype.generate = function (name, params) {
        return this.recognizer.generate(name, params);
      };

      Router.prototype.addRoute = function (config) {
        var navModel = arguments[1] === undefined ? {} : arguments[1];
        if (!("viewPorts" in config)) {
          config.viewPorts = {
            "default": {
              moduleId: config.moduleId
            }
          };
        }

        navModel.title = navModel.title || config.title;

        this.routes.push(config);
        this.recognizer.add([{ path: config.route, handler: config }]);

        if (config.route) {
          var withChild = JSON.parse(JSON.stringify(config));
          withChild.route += "/*childRoute";
          withChild.hasChildRouter = true;
          this.childRecognizer.add([{
            path: withChild.route,
            handler: withChild
          }]);

          withChild.navModel = navModel;
        }

        config.navModel = navModel;

        if (("nav" in config || "order" in navModel) && this.navigation.indexOf(navModel) === -1) {
          navModel.order = navModel.order || config.nav;
          navModel.href = navModel.href || config.href;
          navModel.isActive = false;
          navModel.config = config;

          if (!config.href) {
            navModel.relativeHref = config.route;
            navModel.href = "";
          }

          if (typeof navModel.order != "number") {
            navModel.order = ++this.fallbackOrder;
          }

          this.navigation.push(navModel);
          this.navigation = this.navigation.sort(function (a, b) {
            return a.order - b.order;
          });
        }
      };

      Router.prototype.handleUnknownRoutes = function (config) {
        var callback = function (instruction) {
          return new Promise(function (resolve, reject) {
            function done(inst) {
              inst = inst || instruction;
              inst.config.route = inst.params.path;
              resolve(inst);
            }

            if (!config) {
              instruction.config.moduleId = instruction.fragment;
              done(instruction);
            } else if (typeof config == "string") {
              instruction.config.moduleId = config;
              done(instruction);
            } else if (typeof config == "function") {
              processPotential(config(instruction), done, reject);
            } else {
              instruction.config = config;
              done(instruction);
            }
          });
        };

        this.catchAllHandler = callback;
      };

      Router.prototype.reset = function () {
        this.fallbackOrder = 100;
        this.recognizer = new RouteRecognizer();
        this.childRecognizer = new RouteRecognizer();
        this.routes = [];
        this.isNavigating = false;
        this.navigation = [];
      };

      _export("Router", Router);
    }
  };
});