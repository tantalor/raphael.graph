(function (Raphael) {
  Raphael.fn.graph = {};
  
  Raphael.fn.graph.enable = function (types)
  {
    // by default only extend circle
    if (!types) types = ['circle'];
    
    // extend given types
    for (var i = 0; i < types.length; i++)
    {
      var type = types[i];
      this[type] = function (paper, fn)
      {
        return function ()
        {
          var element = fn.apply(paper, arguments);
          element.graph = new GraphExtension(element);
          return element;
        };
      }(this, this[type]);
    }
    
    return this;
  }
    
  var GraphExtension = function (element)
  {
    this.element = element;
    this.paper = element.paper;
  }
  
  GraphExtension.prototype.graph = function (g)
  {
    return this._graph = g || this._graph;
  }

  GraphExtension.prototype.edgeTo = function (el, weight)
  {
    if (this.graph() && el.graph.graph() && this.graph() !== el.graph.graph()) {
      this.graph().each(function (v)
      {
        // copy this graph to el's graph
        for (var u in this.adj(v))
        {
          var edge = this.get(v, u);
          el.graph.graph().set(v, this.vertex(u), edge);
        }
      
        v.graph.graph(el.graph.graph());
      });
    
    } else {  
      // assign graph
      this.graph(el.graph.graph(this.graph() || el.graph.graph() || new Graph()));
    }
  
    // no loops, no multiedges
    if (this.element === el || this.graph().has(this.element, el))
      return;
  
    // create edge
    this.drawEdge(el);
  
    // attach listeners to redraw edges on drag
    this.setupVertex();
    el.graph.setupVertex();
    
    return this.element;
  }

  GraphExtension.prototype.edgesToRedraw = function ()
  {
    // edges (pairs) with any parent in the set
    
    if (!this.element.draggable) return;

    if (this.element.draggable.parent && this.element.draggable.parent._to_redraw)
    {
      return this.element.draggable.parent._to_redraw;
    }
  
    var to_redraw = []; // [[u, v], ...]
    var set_vertices = {}; // 
  
    for (var i = 0; i < this.element.draggable.parent.items.length; i++)
      set_vertices[this.element.draggable.parent.items[i]] = 1;
  
    this.graph().each(function (v)
    {
      for (var u in this.adj(v))
      {
        if (u < v && (v in set_vertices || u in set_vertices))
        {
          to_redraw.push([this.vertex(u), this.vertex(v)]);
        }
      }
    });
  
    return this.element.draggable.parent._to_redraw = to_redraw;
  }

  GraphExtension.prototype.setupVertex = function ()
  {
    if (!this.element.draggable) return;
    
    if (this._setup_vertex) return;
    this._setup_vertex = 1;
    
    // drag start
    this.element.mousedown(function (event)
    {
      if (event.shiftKey)
      {
        // create set or get existing set
        var set = this.paper._set = this.paper._set || this.paper.set().draggable.enable();
        delete set._to_redraw;
        // gather other elements in the set
        var others = new Array();
        for (var i = 0; i < set.length; i++) {
          if (set[i] != this) {
            others.push(set[i]);
          }
        }
        if (others.length != set.length) {
          // disable old set
          set.draggable.disable();
          // create a new set without the element
          set = this.paper._set = this.paper.set().draggable.enable();
          for (var i = 0; i < others.length; i++) {
            set.push(others[i]);
          }
          this.attr('fill', 'blue');
          this.graph.colorNeighbors('blue');
        } else {
          // add this element to the set
          set.push(this);
          this.attr('fill', 'green');
          this.graph.colorNeighbors('red');
        }
      } else if (!this.graph.hasEnabledSet())
      {
        // check for current set
        if (this.paper._set)
        {
          var set = this.paper._set;
          delete this.paper._set;
          // disable the set
          set.draggable.disable();
          // return everything to original color
          this.graph.graph().each(function (v)
          {
            this.vertex(v).attr('fill', 'blue');
          });
        }
        // color neighbors the active-neighbor color
        this.graph.colorNeighbors('red');
      }
    });
  
    // dragging
    this.element.draggable.dragged(function ()
    {
      // bounding box constraints
      var x = this.attr('cx');
      var y = this.attr('cy');
      var r = this.attr('r');
      var w = this.paper.width;
      var h = this.paper.height;
      var y_max = h - r - 1;
      var x_max = w - r - 1;
      
      if (r && w && h && (x < r || x > x_max || y < r || y > y_max)) {
        // new and cx, cy
        var cx = Math.min(Math.max(r, x), x_max);
        var cy = Math.min(Math.max(r, y), y_max);
        
        if (this.graph.hasEnabledSet()) {
          // difference
          var dx = cx - x;
          var dy = cy - y;
          // move every element to valid position
          var items = this.draggable.parent.items;
          for (var i = 0; i < items.length; i++) {
            items[i].attr({
              cx: items[i].attr('cx') + dx,
              cy: items[i].attr('cy') + dy
            });
          }
        } else {
          // move this element to valid position
          this.attr({
            cx: cx,
            cy: cy
          });
        }
        // end dragging
        this.paper.draggable.clearCurrent();
        this.graph.dragEnd.call(this);
      }
      
      // check if we are in a set
      if (this.graph.hasEnabledSet())
      {
        // redraw edges with any parent in the set
        var to_redraw = this.graph.edgesToRedraw();
        for (var i = 0; i < to_redraw.length; i++)
        {
          to_redraw[i][0].graph.drawEdge(to_redraw[i][1]);
        }
      } else
      {
        this.graph.drawEdges();
      }
    });
  
    // drag end
    this.element.mouseup(this.dragEnd);
  }
  
  GraphExtension.prototype.dragEnd = function ()
  {
    if (!this.graph.hasEnabledSet())
    {
      // color neighbors the default color
      this.graph.colorNeighbors('blue');
    }
  }
  
  GraphExtension.prototype.hasEnabledSet = function ()
  {
    return this.element.draggable.parent && this.element.draggable.parent.draggable.enabled;
  }
  
  GraphExtension.prototype.isSetNeighbor = function (v)
  {
    return v.attr('fill') === 'green';
  }

  GraphExtension.prototype.isFringeNeighbor = function (v)
  {
    return v.attr('fill') === 'red';
  }

  GraphExtension.prototype.colorNeighbors = function (color)
  {
    for (var id in this.graph().adj(this.element))
    {
      var v = this.graph().vertex(id);
      if (!this.isSetNeighbor(v))
      {
        this.graph().vertex(id).attr('fill', color)
      }
    }
  
    return this.element;
  }

  GraphExtension.prototype.drawEdges = function ()
  {
    for (var id in this.graph().adj(this.element))
      this.drawEdge(this.graph().vertex(id));
  
    return this.element;
  }

  GraphExtension.prototype.drawEdge = function (el)
  {
    var x1 = this.element.attr('cx'),
      y1 = this.element.attr('cy'), 
      x2 = el.attr('cx'),
      y2 = el.attr('cy');
    
    var path = ['M', x1, y1, 'L', x2, y2];
    
    var edge = this.graph().get(this.element, el);
    if (edge) {
      // move existing edge
      edge.attr('path', path);
      edge.x = edge.head.attr('x');
      edge.y = edge.head.attr('y');
      return this.element;
    } else {
      // create new edge
      edge = this.paper.path(path);
      edge.head = this.element;
      edge.x = x1; edge.y = y1;
      this.graph().set(this.element, el, edge);
      this.element.toFront();
      el.toFront();
      return this.element;
    }
  }

  GraphExtension.prototype.edges = function (fn)
  {
    this.graph().each(function (v)
    {
      for (var u in this.adj(v))
      {
        if (u < v) {
          fn(this.vertex(u), v);
        }
      }
    });
  }
  
  // calls fn(e1, e2) for every pair of intersecting edges (e1, e2)
  GraphExtension.prototype.intersecting = function (fn)
  {
    this.edges(function (u, v) {
      var uv = u.graph.graph().get(u, v);
      var uv_path = uv.attr('path');
      var a = [[uv_path[0][1], uv_path[0][2]], [uv_path[1][1], uv_path[1][2]]];
      u.graph.edges(function (s, t) {
        if (u != s && u != t && v != s && v != t && u < s) {
          var st = s.graph.graph().get(s, t);
          var st_path = st.attr('path');
          var b = [[st_path[0][1], st_path[0][2]], [st_path[1][1], st_path[1][2]]];
          if (intersects(a, b)) {
            fn(uv, st);
          }
        }
      });
    });
  }
  
  // Jason Davies (2011) http://www.jasondavies.com/planarity/
  // Returns true if two line segments intersect.
  // Based on http://stackoverflow.com/a/565282/64009
  function intersects(a, b) {
    // Check if the segments are exactly the same (or just reversed).
    if (a[0] === b[0] && a[1] === b[1] || a[0] === b[1] && a[1] === b[0]) return true;
    
    // Represent the segments as p + tr and q + us, where t and u are scalar
    // parameters.
    var p = a[0],
        r = [a[1][0] - p[0], a[1][1] - p[1]],
        q = b[0],
        s = [b[1][0] - q[0], b[1][1] - q[1]];
    
    // Solve p + tr = q + us to find an intersection point.
    // First, cross both sides with s:
    //   (p + tr) × s = (q + us) × s
    // We know that s × s = 0, so this can be rewritten as:
    //   t(r × s) = (q − p) × s
    // Then solve for t to get:
    //   t = (q − p) × s / (r × s)
    // Similarly, for u we get:
    //   u = (q − p) × r / (r × s)
    var rxs = cross(r, s),
        q_p = [q[0] - p[0], q[1] - p[1]],
        t = cross(q_p, s) / rxs,
        u = cross(q_p, r) / rxs,
        epsilon = 1e-6;
    
    return t > epsilon && t < 1 - epsilon && u > epsilon && u < 1 - epsilon;
  }
  
  function cross(a, b) {
    return a[0] * b[1] - a[1] * b[0];
  }
  
  Raphael.el.toString = function ()
  {
    // Graph needs toString() on elements to identify vertices
    return "Raphael Object #"+this.id;
  }
})(Raphael);
