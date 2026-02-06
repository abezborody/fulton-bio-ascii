import bpy
from math import radians, sin, cos, pi


def create_crab_cage():
    # Clear existing scene
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=True)

    # Create materials
    wire_material = bpy.data.materials.new(name="WireMaterial")
    wire_material.use_nodes = True
    bsdf = wire_material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Metallic"].value = 0.8
    bsdf.inputs["Roughness"].value = 0.3
    bsdf.inputs["Base Color"].default_value = (0.7, 0.7, 0.7, 1)

    # Function to create wire frame
    def create_wire_frame(radius, height, segments, rings, wire_radius=0.01):
        # Create vertical wires
        for i in range(segments):
            angle = (2 * pi * i) / segments
            x = radius * cos(angle)
            y = radius * sin(angle)

            # Create cylinder for vertical wire
            bpy.ops.mesh.primitive_cylinder_add(
                radius=wire_radius,
                depth=height,
                location=(x, y, height / 2),
                rotation=(radians(90), 0, 0),
            )
            bpy.context.object.name = f"VerticalWire_{i}"
            bpy.context.object.data.materials.append(wire_material)

        # Create horizontal rings
        for j in range(rings + 1):
            z = (height * j) / rings
            bpy.ops.mesh.primitive_torus_add(
                major_radius=radius,
                minor_radius=wire_radius,
                location=(0, 0, z),
                rotation=(0, 0, 0),
            )
            bpy.context.object.name = f"Ring_{j}"
            bpy.context.object.data.materials.append(wire_material)

    # Create main cylindrical body
    body_radius = 1.0
    body_height = 2.0
    body_segments = 16
    body_rings = 8

    create_wire_frame(body_radius, body_height, body_segments, body_rings)

    # Create top cone (entrance)
    def create_cone_frame(base_radius, height, segments, wire_radius=0.01):
        # Create vertical wires for cone
        for i in range(segments):
            angle = (2 * pi * i) / segments

            # Create spiral wire from base to tip
            points = []
            for j in range(20):
                t = j / 19
                r = base_radius * (1 - t)
                x = r * cos(angle)
                y = r * sin(angle)
                z = height * t + body_height
                points.append((x, y, z))

            # Create curve for wire
            curve = bpy.data.curves.new("ConeWire", type="POLY")
            curve.dimensions = "3D"
            spline = curve.splines.new("POLY")
            spline.points.add(len(points) - 1)

            for idx, point in enumerate(points):
                spline.points[idx].co = (*point, 1)

            obj = bpy.data.objects.new(f"ConeWire_{i}", curve)
            bpy.context.collection.objects.link(obj)

            # Add bevel to make it a wire
            obj.data.bevel_depth = wire_radius
            obj.data.materials.append(wire_material)

        # Create horizontal rings for cone
        for j in range(5):
            t = (j + 1) / 5
            r = base_radius * (1 - t)
            z = height * t + body_height

            if r > 0.05:  # Only create rings if radius is significant
                bpy.ops.mesh.primitive_torus_add(
                    major_radius=r,
                    minor_radius=wire_radius,
                    location=(0, 0, z),
                    rotation=(0, 0, 0),
                )
                bpy.context.object.name = f"ConeRing_{j}"
                bpy.context.object.data.materials.append(wire_material)

    # Create top cone
    cone_height = 0.8
    cone_segments = 16
    create_cone_frame(body_radius * 0.7, cone_height, cone_segments)

    # Create bottom cone (smaller)
    def create_bottom_cone(base_radius, height, segments, wire_radius=0.01):
        # Similar to top cone but inverted at bottom
        for i in range(segments):
            angle = (2 * pi * i) / segments

            points = []
            for j in range(15):
                t = j / 14
                r = base_radius * (1 - t)
                x = r * cos(angle)
                y = r * sin(angle)
                z = -height * t
                points.append((x, y, z))

            curve = bpy.data.curves.new("BottomConeWire", type="POLY")
            curve.dimensions = "3D"
            spline = curve.splines.new("POLY")
            spline.points.add(len(points) - 1)

            for idx, point in enumerate(points):
                spline.points[idx].co = (*point, 1)

            obj = bpy.data.objects.new(f"BottomConeWire_{i}", curve)
            bpy.context.collection.objects.link(obj)
            obj.data.bevel_depth = wire_radius
            obj.data.materials.append(wire_material)

    # Create bottom cone
    bottom_cone_height = 0.5
    create_bottom_cone(body_radius * 0.5, bottom_cone_height, cone_segments)

    # Add entrance funnel (funnel-shaped opening inside top cone)
    def create_entrance_funnel():
        # Create a funnel shape inside the top cone
        funnel_radius = 0.3
        funnel_height = 0.4

        # Create funnel wires
        for i in range(8):
            angle = (2 * pi * i) / 8

            points = []
            for j in range(10):
                t = j / 9
                r = funnel_radius * (1 - t * 0.5)  # Taper towards bottom
                x = r * cos(angle)
                y = r * sin(angle)
                z = body_height + cone_height - funnel_height + funnel_height * t
                points.append((x, y, z))

            curve = bpy.data.curves.new("FunnelWire", type="POLY")
            curve.dimensions = "3D"
            spline = curve.splines.new("POLY")
            spline.points.add(len(points) - 1)

            for idx, point in enumerate(points):
                spline.points[idx].co = (*point, 1)

            obj = bpy.data.objects.new(f"FunnelWire_{i}", curve)
            bpy.context.collection.objects.link(obj)
            obj.data.bevel_depth = 0.008
            obj.data.materials.append(wire_material)

    create_entrance_funnel()

    # Select all objects
    bpy.ops.object.select_all(action="SELECT")
    # Join all objects into one
    bpy.context.view_layer.objects.active = bpy.context.scene.objects["VerticalWire_0"]
    bpy.ops.object.join()

    # Rename the final object
    bpy.context.object.name = "CrabCage"

    # Center the object
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    bpy.context.object.location = (0, 0, 0)

    print("Crab cage model created successfully!")


# Run the function
create_crab_cage()
