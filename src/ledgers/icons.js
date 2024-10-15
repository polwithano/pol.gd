async function LoadIcon(key) 
{
    try 
    {
        const icon = await import(`../../public/media/icons/${key}.png`);
        return icon;
    } 
    catch (error) 
    {
        console.warn(`Icon for key "${key}" not found. Loading placeholder icon instead.`);
        return import('../../public/media/icons/placeholder.png');
    }
}


export default {LoadIcon}