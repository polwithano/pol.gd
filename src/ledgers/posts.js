import jsyaml from 'js-yaml';

const posts = [
]

async function LoadPost(name)
{ 
    const response = await fetch(`../../public/data/posts/${name}.md`);
    
    console.log(`Fetched URL: ${response.url}`);
    
    if (!response.ok) {
        console.error(`Failed to load file: ${response.status} ${response.statusText}`);
        return;
    }

    const content = await response.text(); 
    //console.log(`Content Loaded: ${content.substring(0, 100)}`);  // Output a snippet of content for debugging

    const parts = content.split('---'); 
    const metadata = ParseYAML(parts[1]); 
    const markdown = parts[2];  

    return {metadata, markdown}
}

async function FetchPostsMetadata() 
{
    const time = performance.now(); 
    let metadatas = [];

    for (let i = 0; i < posts.length; i++) {
        const url = `../../public/data/posts/${posts[i]}.md`;
        const response = await fetch(url);
        
        // Check for a successful response
        if (!response.ok) {
            console.error(`Failed to fetch post: ${url}, status: ${response.status}`);
            continue; // Skip this iteration if the fetch fails
        }

        const content = await response.text();
        
        // Split the YAML metadata from the markdown content
        const parts = content.split('---');

        // Check if the split was successful
        if (parts.length < 3) { // We expect at least three parts: start, metadata, and content
            console.error(`Invalid post format in ${posts[i]}.md. Content:`, content);
            continue; // Skip this iteration if the format is invalid
        }

        // Use js-yaml to parse the metadata correctly
        const metadata = jsyaml.load(parts[1].trim()); // Trim to remove unnecessary whitespace
        
        metadatas.push(metadata);
    }

    const timeEnd = performance.now(); 
    const duration  = (timeEnd - time);
    console.log(`Time taken to fetch and process posts metadata: ${duration} milliseconds`);
    return metadatas;
}

function ParseYAML(yamlString) 
{
    // A simple YAML parser, or use a library like js-yaml
    return yamlString.split('\n').reduce((acc, line) => {
        const [key, value] = line.split(':').map(str => str.trim());
        if (key && value) acc[key] = value;
        return acc;
    }, {});
}

export default {posts, LoadPost, FetchPostsMetadata}