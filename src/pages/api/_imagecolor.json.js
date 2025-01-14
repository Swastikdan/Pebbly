export async function GET() {
  return new Response(JSON.stringify({ color: "#5C735D" }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

// import getColors from 'get-image-colors';

// export async function GET({ request }) {
//   const url = new URL(request.url);
//   let image = url.searchParams.get('image');
//   if (!/^https?:\/\/.*/.test(image)) {
//     image = decodeURIComponent(image);
//   }

//   if (
//     !image ||
//     image == 'undefined' ||
//     image == 'null' ||
//     image ==
//       '/https://image.tmdb.org/t/p/originalnull'
//   ) {
//     return new Response(JSON.stringify({ color: '#5C735D' }), {
//       status: 200,
//       headers: {
//         'Content-Type': 'application/json',
//       },
//     });
//   }

//   try{
//   const colors = await getColors(image);
//   let color = colors[0].hex();
//   let r = parseInt(color.slice(1, 3), 16);
//   let g = parseInt(color.slice(3, 5), 16);
//   let b = parseInt(color.slice(5, 7), 16);
//   let brightness = (r * 299 + g * 587 + b * 114) / 1000;
//   if (brightness > 200) {
//     // If the color is very light, make it medium dark
//     r = Math.round(r * 0.6);
//     g = Math.round(g * 0.6);
//     b = Math.round(b * 0.6);
//   }
//   else if (brightness > 100) {
//     // If the color is medium light, make it dark
//     r = Math.round(r * 0.8);
//     g = Math.round(g * 0.8);
//     b = Math.round(b * 0.8);
//   }
//   else if (brightness < 50) {
//     // If the color is very dark, make it less dark
//     r = Math.round(r * 1.4);
//     g = Math.round(g * 1.4);
//     b = Math.round(b * 1.4);
//   }

//   // Ensure the values are within the valid range
//   r = Math.min(255, Math.max(0, r));
//   g = Math.min(255, Math.max(0, g));
//   b = Math.min(255, Math.max(0, b));

//   // Convert the RGB values back to a hex color
//   color =
//     '#' +
//     r.toString(16).padStart(2, '0') +
//     g.toString(16).padStart(2, '0') +
//     b.toString(16).padStart(2, '0');

//   return new Response(JSON.stringify({ color }), {
//     status: 200,
//     headers: {
//       'Content-Type': 'application/json',
//     },
//   }); } catch (e) {
//     console.error(e);
//     return new Response(JSON.stringify({ color: '#5C735D' }), {
//       status: 200,
//       headers: {
//         'Content-Type': 'application/json',
//       },
//     });
//   }
// }
