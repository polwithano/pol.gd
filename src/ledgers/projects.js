const projects = [
    "Space Architect",
    "Zer0 Day",
    "Brutal Fighters",
    "Agent X",
    "Stellar Pulse",
    "Because I Love You",
    "Moonshine Inc.",
    "pol.gd",
    "Tile Editor",
    "Raycaster"
]

async function LoadProjectData(key) 
{
    const [project, voxel] = await Promise.all([
        import(`../../public/data/projects/${key}_data.json`),
        import(`../../public/data/voxels/${key}_voxel.json`),
    ]);
    return {project, voxel}; 
}

function FetchAssetURL(projectData) 
{
    let urls = [];

    const { content, metadata } = projectData;
    const contentFolder = metadata.contentFolder || 'default-folder'; 
    const mediaBasePath = `./media/projects/${contentFolder}/`;

    // Add the header image URL
    if (content.header) {
        urls.push(mediaBasePath + content.header);
    }

    // Collect image URLs from sections synchronously
    content.sections
        .filter(section => 
            (section.type === 'text-image' || section.type === 'gif') 
            && section.content.image && section.content.image.imageURL)
        .forEach(section => {
            const imageUrl = mediaBasePath + section.content.image.imageURL;
            urls.push(imageUrl); // Add each imageURL to the urls array
        });

    return urls;
}

async function FetchProjectsMetadata() 
{
    const time = performance.now(); 
    let metadatas = []; 
    
    for (let i = 0; i < projects.length; i++) 
    {
        const projectData = await import(`../../public/data/projects/${projects[i]}_data.json`); 
        metadatas.push(projectData.metadata); 
    }

    const timeEnd = performance.now(); 
    const duration  = (timeEnd - time); 
    console.log(`Time taken to fetch and process projects metadata: ${duration} milliseconds`);

    return metadatas; 
}

export default {projects, LoadProjectData, FetchAssetURL, FetchProjectsMetadata}