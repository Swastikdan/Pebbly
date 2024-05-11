export default function Share({ title, description, url , bg }) {
  return (
    <button
      onClick={() => {
        if (navigator.share) {
          navigator
            .share({
              title: title,
              url: url,
            })
            .then(() => {
              // console.log('Thanks for sharing!');
            })
            .catch(console.error);
        } else {
          // fallback for browsers that don't support navigator.share
          const textArea = document.createElement('textarea');
          textArea.value = `${title} ${url}`;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          alert('Link copied to clipboard');
        }
      }}
      className={`focius:outline-none flex items-end justify-end space-x-2 rounded-lg px-2 py-1  font-medium focus:ring-2  focus:ring-gray-400 sm:text-lg ${bg ? 'hover:bg-gray-200/70' : ''}`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className=" size-6 sm:size-7"
      >
        <circle cx="18" cy="5" r="3"></circle>
        <circle cx="6" cy="12" r="3"></circle>
        <circle cx="18" cy="19" r="3"></circle>
        <line x1="8.59" x2="15.42" y1="13.51" y2="17.49"></line>
        <line x1="15.41" x2="8.59" y1="6.51" y2="10.49"></line>
      </svg>
      <span>Share</span>
    </button>
  );
}
