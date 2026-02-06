# Exporting Crab Cage to .gbl for WebGL

## Steps to create and export the crab cage model:

### 1. Install Blender
- Download and install Blender from https://blender.org/

### 2. Run the Python script
- Open Blender
- Go to Scripting workspace
- Click "Open" and select `crab_cage_generator.py`
- Click "Run Script" button
- The crab cage model will be generated

### 3. Export to .gbl format
Since .gbl is not a standard Blender export format, you have several options:

#### Option A: Export to glTF/GLB (Recommended for WebGL)
1. Select the CrabCage object
2. Go to File > Export > glTF 2.0 (.glb/.gltf)
3. Set Format to "glTF Binary (.glb)"
4. Check these options:
   - Apply Modifiers
   - Include: Materials, Textures
   - Mesh: +Normals, +Tangents
5. Click "Export glTF 2.0 Binary"

#### Option B: Export to OBJ with custom converter
1. File > Export > Wavefront (.obj)
2. After exporting, use a third-party converter to convert .obj to .gbl

#### Option C: Export to Three.js JSON format
1. Install the Three.js Blender addon
2. File > Export > Three.js (.json)
3. Use Three.js loader in your WebGL scene

### 4. Optimize for WebGL
In the export settings, consider:
- Reducing polygon count if needed
- Baking materials into textures
- Using Draco compression for glTF

### 5. Using in WebGL
For glTF/GLB files, use libraries like:
- Three.js: `GLTFLoader`
- Babylon.js: `SceneLoader.ImportMesh`

## Model Parameters
The generated model has:
- Main cylinder: 2m height, 1m radius
- Top cone: 0.8m height
- Bottom cone: 0.5m height
- Wire thickness: 1cm

You can modify these values in the Python script before running.
