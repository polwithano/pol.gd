const projects = 
[
    "test_project",
    "test_project2"
]

async function LoadProjectData(key) 
{
    if (key == 'test_project') 
    {
        const [project, voxel] = await Promise.all([
            import('./projects/test_data.json'), 
            import('./voxels/test_voxel.json')
        ]);
        return {project, voxel}; 
    }
    if (key == 'test_project2') 
    {
        const [project, voxel] = await Promise.all([
            import('./projects/test_2_data.json'), 
            import('./voxels/test_2_voxel.json')
        ]);
        return {project, voxel}; 
    }
}

export default {projects, LoadProjectData}