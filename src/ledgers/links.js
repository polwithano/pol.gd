const links = 
[
    "github-link",
    "linkedin-link",
    "reddit-link",
    "resume-link",
    "mail-link"
]

async function FetchLinks() 
{
    let data = [];

    for (let i = 0; i < links.length; i++) 
    {
        const link = await import(`../../data/links/${links[i]}.json`);
        data.push(link);  
    }

    return data; 
}

export default {FetchLinks}