const projects = 
[
    "Space Architect",
    "Zer0 Day",
    "Brutal Fighters",
    "Agent X",
    "Stellar Pulse",
    "Because I Love You",
    "Moonshine Inc."
]

async function LoadProjectData(key) 
{
    const [project, voxel] = await Promise.all([
        import(`./projects/${key}_data.json`),
        import(`./voxels/${key}_voxel.json`),
    ]);
    return {project, voxel}; 
}

async function LoadProjectAssets(projectData) 
{
    try 
    {
        const { content, metadata } = projectData;
        
        const contentFolder = metadata.contentFolder || 'default-folder'; 
        const mediaBasePath = `../media/projects/${contentFolder}`;
        const placeholder = await import('../media/placeholder-image.jpg');

        let header; 
        try {
            let src = `${mediaBasePath}/${content.header}.jpg`; 
            header = await import(src);
            console.log('Loading image:', src); 
        } catch (error) {
            header = placeholder;
        }

        // Filter for sections that have an image and check for imageIndex in section.content.image
        const images = await Promise.all(
            content.sections
                .filter(section => section.type === 'text-image' && section.content.image && section.content.image.imageIndex)
                .map(async (section) => {
                    const index = section.content.image.imageIndex; 
                    const src = `${mediaBasePath}/${index}.jpg`;
                    console.log('Loading image:', src); 

                    let image; 
                    try {
                        image = await import(src);
                    } catch (error) {
                        image = placeholder;
                    }
                    
                    return {
                        ...section.content.image, 
                        src: image
                    };
                })
        );

        return { header, images };
    } 
    catch (error) 
    {
        console.error('Error loading project assets:', error);
        return null;  
    }
}

async function FetchProjectsMetadata() 
{
    const time = performance.now(); 

    let metadatas = []; 
    for (let i = 0; i < projects.length; i++) 
    {
        const projectData = await import(`./projects/${projects[i]}_data.json`); 
        metadatas.push(projectData.metadata); 
    }

    const timeEnd = performance.now(); 
    const duration  = (timeEnd - time); 
    console.log(`Time taken to fetch and process metadata: ${duration} milliseconds`);

    return metadatas; 
}

export default {projects, LoadProjectData, LoadProjectAssets, FetchProjectsMetadata}