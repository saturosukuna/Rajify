import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { 
  MusicalNoteIcon, 
  PlayIcon, 
  PauseIcon, 
  ForwardIcon, 
  BackwardIcon, 
  SpeakerWaveIcon,
  ChevronDownIcon,
  ListBulletIcon
} from '@heroicons/react/24/solid'

const formatSeconds = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const formatDuration = (duration) => {
  const match = duration?.match(/PT(\d+H)?(\d+M)?(\d+S)?/) || []
  let hours = 0, minutes = 0, seconds = 0

  if (match[1]) hours = parseInt(match[1].slice(0, -1))
  if (match[2]) minutes = parseInt(match[2].slice(0, -1))
  if (match[3]) seconds = parseInt(match[3].slice(0, -1))

  return hours > 0 
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function App() {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [currentTrack, setCurrentTrack] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(1)
  const [progress, setProgress] = useState(0)
  const [language, setLanguage] = useState('tamil')
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const playerRef = useRef(null)
  const [currentIndex, setCurrentIndex] = useState(null)
  const [searchType, setSearchType] = useState('songs') // 'songs' or 'playlists'
  const [currentPlaylist, setCurrentPlaylist] = useState(null)


  const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY

  useEffect(() => {
    const tag = document.createElement('script')
    tag.src = "https://www.youtube.com/iframe_api"
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)

    window.onYouTubeIframeAPIReady = () => {
      playerRef.current = new window.YT.Player('player', {
        height: '0',
        width: '0',
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange
        }
      })
    }
  }, [])

  const onPlayerReady = (event) => {
    event.target.setVolume(volume * 100)
  }

  const onPlayerStateChange = (event) => {
    if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true)
      startProgressTracker()
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      setIsPlaying(false)
    } else if (event.data === window.YT.PlayerState.ENDED) {
      setIsPlaying(false)
      setProgress(0)
    }
  }

  const startProgressTracker = () => {
    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const current = playerRef.current.getCurrentTime()
        const total = playerRef.current.getDuration()
        setProgress((current / total) * 100)
        setCurrentTime(formatSeconds(current))
        setDuration(formatSeconds(total))
      }
    }, 1000)
  }

  useEffect(() => {
    const fetchRandomSongs = async () => {
      try {
        const searchQuery = language === 'tamil' 
          ? 'latest tamil songs' 
          : 'latest english songs'
        
        const { data } = await axios.get(
          'https://www.googleapis.com/youtube/v3/search',
          {
            params: {
              part: 'snippet',
              q: searchQuery,
              type: 'video',
              videoCategoryId: '10',
              videoDuration: 'medium',
              maxResults: 20,
              key: YOUTUBE_API_KEY,
              order: 'viewCount'
            }
          }
        )
        
        const videosWithDuration = await fetchDurations(data.items)
        setResults(videosWithDuration)
      } catch (error) {
        console.error('Error fetching songs:', error)
      }
    }

    fetchRandomSongs()
  }, [language, YOUTUBE_API_KEY])

  const fetchDurations = async (videos) => {
    const videoIds = videos.map(v => v.id.videoId).join(',')
    try {
      const { data } = await axios.get(
        'https://www.googleapis.com/youtube/v3/videos',
        {
          params: {
            part: 'contentDetails',
            id: videoIds,
            key: YOUTUBE_API_KEY
          }
        }
      )
      
      return videos.map(video => ({
        ...video,
        duration: data.items.find(item => item.id === video.id.videoId)?.contentDetails.duration
      }))
    } catch (error) {
      console.error('Error fetching durations:', error)
      return videos
    }
  }
  const fetchPlaylistTracks = async (playlistId) => {
    try {
      const { data } = await axios.get(
        'https://www.googleapis.com/youtube/v3/playlistItems',
        {
          params: {
            part: 'snippet',
            playlistId: playlistId,
            maxResults: 10,
            key: YOUTUBE_API_KEY
          }
        }
      )

      const videos = data.items.map(item => ({
        id: { videoId: item.snippet.resourceId.videoId },
        snippet: {
          ...item.snippet,
          title: item.snippet.title,
          channelTitle: item.snippet.videoOwnerChannelTitle,
          thumbnails: item.snippet.thumbnails
        }
      }))

      const videosWithDuration = await fetchDurations(videos)
      setResults(videosWithDuration)
      setSearchType('songs')
      setCurrentPlaylist(playlistId)
    } catch (error) {
      console.error('Error fetching playlist tracks:', error)
    }
  }
  const searchTracks = async (e) => {
    e.preventDefault()
    if (!searchTerm) return

    try {
      let params = {
        part: 'snippet',
        q: `${searchTerm} ${language} ${searchType === 'playlists' ? 'playlist' : 'song'}`,
        type: searchType === 'playlists' ? 'playlist' : 'video',
        maxResults: 10,
        key: YOUTUBE_API_KEY
      }

      if (searchType === 'songs') {
        params.videoCategoryId = '10'
        params.videoDuration = 'medium'
      }

      const { data } = await axios.get(
        'https://www.googleapis.com/youtube/v3/search',
        { params }
      )

      if (searchType === 'playlists') {
        setResults(data.items)
      } else {
        const videosWithDuration = await fetchDurations(data.items)
        setResults(videosWithDuration)
      }
    } catch (error) {
      console.error('Error searching:', error)
    }
  }


  const playTrack = (video) => {
    const index = results.findIndex((item) => item.id.videoId === video.id.videoId);
    
    if (playerRef.current && index !== -1) {
      playerRef.current.loadVideoById(video.id.videoId);
      console.log(video.id.videoId);
      playerRef.current.playVideo();
      setCurrentIndex(index); 
      setCurrentTrack(video);
    }
    
  };
  
  const playNext = () => {
    console.log('called');
    console.log(currentIndex);
    if (!results || results.length === 0) return; // Ensure results exist
    const nextIndex = currentIndex === null ? 0 : (currentIndex + 1) % results.length;
    console.log(nextIndex);
    if (results[nextIndex]) {
      playTrack(results[nextIndex], nextIndex);
    }
  };
  
  const playPrevious = () => {
    if (!results || results.length === 0) return; // Ensure results exist
    const prevIndex = currentIndex === null ? results.length - 1 : (currentIndex - 1 + results.length) % results.length;
    if (results[prevIndex]) {
      playTrack(results[prevIndex], prevIndex);
    }
  };
  
  

  const togglePlay = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo()
      } else {
        playerRef.current.playVideo()
      }
    }
  }


  const handleProgressClick = (e) => {
    const rect = e.target.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const newTime = percentage * playerRef.current.getDuration()
    playerRef.current.seekTo(newTime)
  }

  const handleLanguageChange = (lang) => {
    setLanguage(lang)
    setIsDropdownOpen(false)
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* Main Content */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Sidebar (keep same) */}

        {/* Main Area */}
        <div className="flex-1 overflow-y-auto p-8">
        <h1 className="text-2xl font-bold mb-8 flex items-center gap-2">
            <MusicalNoteIcon className="h-8 w-8 text-green-500" />
            Rajify
          </h1>
          
          <div className="relative mb-6">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full flex justify-between items-center px-4 py-2 bg-white/10 rounded-lg"
            >
              {language.charAt(0).toUpperCase() + language.slice(1)}
              <ChevronDownIcon className="h-4 w-4" />
            </button>
            
            {isDropdownOpen && (
              <div className="absolute w-full mt-2 bg-white/10 backdrop-blur-lg rounded-lg">
                <button
                  onClick={() => handleLanguageChange('tamil')}
                  className="w-full px-4 py-2 text-left hover:bg-white/20"
                >
                  Tamil
                </button>
                <button
                  onClick={() => handleLanguageChange('english')}
                  className="w-full px-4 py-2 text-left hover:bg-white/20"
                >
                  English
                </button>
              </div>
            )}
          </div>
          <form onSubmit={searchTracks} className="mb-8">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setSearchType('songs')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  searchType === 'songs' ? 'bg-green-500' : 'bg-white/10'
                }`}
              >
                <MusicalNoteIcon className="h-5 w-5" />
                Songs
              </button>
              <button
                type="button"
                onClick={() => setSearchType('playlists')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                  searchType === 'playlists' ? 'bg-green-500' : 'bg-white/10'
                }`}
              >
                <ListBulletIcon className="h-5 w-5" />
                Playlists
              </button>
            </div>
            
            <input
              type="text"
              placeholder={`Search ${language} ${searchType}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-4 rounded-lg bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </form>
<div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-6">
  {results.map((item, index) => (
    searchType === 'playlists' ? (
      <div
        key={item.id?.playlistId || `playlist-${index}`}
        onClick={() => fetchPlaylistTracks(item.id?.playlistId)}
        className="bg-white/5 p-4 rounded-lg hover:bg-white/10 transition cursor-pointer group relative"
      >
        <div className="relative">
          <img
            src={item.snippet.thumbnails?.medium?.url || '/fallback-image.jpg'}
            alt={item.snippet.title}
            className="w-full aspect-square object-cover rounded-lg mb-4"
          />
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
            <PlayIcon className="h-12 w-12 text-white" />
          </div>
        </div>
        <h3 className="font-semibold truncate">{item.snippet.title}</h3>
        <p className="text-gray-400 text-sm truncate">
          {item.snippet.channelTitle}
        </p>
      </div>
    ) : (
      <div
        key={item.id?.videoId || `video-${index}`}
        onClick={() => playTrack(item)}
        className="bg-white/5 p-4 rounded-lg hover:bg-white/10 transition cursor-pointer group relative"
      >
        <div className="relative">
          <img
            src={item.snippet.thumbnails?.medium?.url || '/fallback-image.jpg'}
            alt={item.snippet.title}
            className="w-full aspect-square object-cover rounded-lg mb-4"
          />
          <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-sm">
            {item.duration ? formatDuration(item.duration) : '--:--'}
          </div>
        </div>
        <h3 className="font-semibold truncate">{item.snippet.title}</h3>
        <p className="text-gray-400 text-sm truncate">
          {item.snippet.channelTitle}
        </p>
      </div>
    )
  ))}
</div>
        </div>
      </div>

      <div className="h-38 border-t border-white/10 bg-black/80 backdrop-blur-lg p-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between h-full">
          {/* Track Info */}
          <div className="flex items-center gap-4 w-1/4">
            {currentTrack?.snippet?.thumbnails && (
              <img
                src={currentTrack.snippet.thumbnails.default.url}
                alt="Album Art"
                className="h-14 w-14 rounded-md"
              />
            )}
            <div>
              <h4 className="font-semibold truncate">
                {currentTrack?.snippet?.title || 'Select a song to play'}
              </h4>
              <p className="text-sm text-gray-400 truncate">
                {currentTrack?.snippet?.channelTitle}
              </p>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex flex-col items-center w-2/4">
            <div className="flex items-center gap-6 mb-3">
            <button onClick={playPrevious} className="text-gray-400 hover:text-white transition">
  <BackwardIcon className="h-6 w-6" />
</button>

<button onClick={togglePlay} className="h-10 w-10 rounded-full bg-white flex items-center justify-center hover:scale-105 transition">
  {isPlaying ? <PauseIcon className="h-6 w-6 text-black" /> : <PlayIcon className="h-6 w-6 text-black" />}
</button>

<button onClick={playNext} className="text-gray-400 hover:text-white transition">
  <ForwardIcon className="h-6 w-6" />
</button>

            </div>

            {/* Progress Bar */}
            <div className="w-full flex items-center gap-3">
              <span className="text-sm text-gray-400">{currentTime}</span>
              <div 
                className="flex-1 bg-gray-600 h-1 rounded-full cursor-pointer"
                onClick={handleProgressClick}
              >
                <div 
                  className="bg-green-500 h-full rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-sm text-gray-400">{duration}</span>
            </div>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-3 w-1/4 justify-end">
            <SpeakerWaveIcon className="h-5 w-5" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => {
                const newVolume = parseFloat(e.target.value)
                setVolume(newVolume)
                if (playerRef.current) playerRef.current.setVolume(newVolume * 100)
              }}
              className="w-24 accent-green-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* YouTube Player */}
      <div id="player" className="hidden"></div>
    </div>
  )
}