import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Home, Map, Compass, User, BookOpen, Mail, Heart, LayoutDashboard, LogOut, Loader2, Menu, X, CheckCircle, AlertCircle, Send } from 'lucide-react'; // Added Send icon

// Contexto para o usuário e Firebase
const AppContext = createContext();

const AppProvider = ({ children }) => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [userFavorites, setUserFavorites] = useState([]);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    try {
      const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
      const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
      const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

      if (firebaseConfig) {
        const app = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(app);
        const firebaseAuth = getAuth(app);

        setDb(firestoreDb);
        setAuth(firebaseAuth);

        const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
          if (user) {
            setUserId(user.uid);
            setIsAuthReady(true);
            // Fetch user favorites when authenticated
            const userDocRef = doc(firestoreDb, `artifacts/${appId}/users/${user.uid}/data/favorites`);
            onSnapshot(userDocRef, (docSnap) => {
              if (docSnap.exists()) {
                setUserFavorites(docSnap.data().experiences || []);
              } else {
                setUserFavorites([]);
              }
            });
          } else {
            // Sign in anonymously if no initial token or user logs out
            if (initialAuthToken) {
              try {
                await signInWithCustomToken(firebaseAuth, initialAuthToken);
              } catch (error) {
                console.error("Erro ao fazer login com token personalizado:", error);
                await signInAnonymously(firebaseAuth);
              }
            } else {
              await signInAnonymously(firebaseAuth);
            }
            setIsAuthReady(true);
            setUserId(firebaseAuth.currentUser?.uid || crypto.randomUUID()); // Fallback for anonymous
          }
        });

        return () => unsubscribe();
      } else {
        console.error("Firebase config not available.");
        setIsAuthReady(true); // Allow app to render even without Firebase
        setUserId(crypto.randomUUID()); // Use a random ID if Firebase is not configured
      }
    } catch (error) {
      console.error("Erro ao inicializar Firebase:", error);
      setIsAuthReady(true); // Allow app to render even with Firebase initialization error
      setUserId(crypto.randomUUID()); // Use a random ID if Firebase initialization fails
    }
  }, []);

  const addFavorite = async (experienceId) => {
    if (!db || !userId || !isAuthReady) {
      showNotification('Erro: Autenticação não pronta ou banco de dados indisponível.', 'error');
      return;
    }
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/data/favorites`);
    try {
      await updateDoc(userDocRef, {
        experiences: arrayUnion(experienceId)
      }, { merge: true }); // Use merge to create if not exists, and add to array
      showNotification('Experiência adicionada aos favoritos!', 'success');
    } catch (e) {
      if (e.code === 'not-found') { // Document doesn't exist, create it
        await setDoc(userDocRef, { experiences: [experienceId] });
        showNotification('Experiência adicionada aos favoritos!', 'success');
      } else {
        console.error("Erro ao adicionar favorito:", e);
        showNotification('Erro ao adicionar favorito.', 'error');
      }
    }
  };

  const removeFavorite = async (experienceId) => {
    if (!db || !userId || !isAuthReady) {
      showNotification('Erro: Autenticação não pronta ou banco de dados indisponível.', 'error');
      return;
    }
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const userDocRef = doc(db, `artifacts/${appId}/users/${userId}/data/favorites`);
    try {
      await updateDoc(userDocRef, {
        experiences: arrayRemove(experienceId)
      });
      showNotification('Experiência removida dos favoritos!', 'success');
    } catch (e) {
      console.error("Erro ao remover favorito:", e);
      showNotification('Erro ao remover favorito.', 'error');
    }
  };

  const showNotification = (message, type) => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        setUserId(null);
        setUserFavorites([]);
        showNotification('Você foi desconectado.', 'success');
      } catch (error) {
        console.error("Erro ao fazer logout:", error);
        showNotification('Erro ao fazer logout.', 'error');
      }
    }
  };

  return (
    <AppContext.Provider value={{ db, auth, userId, isAuthReady, userFavorites, addFavorite, removeFavorite, showNotification, handleLogout }}>
      {children}
      {notification && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg flex items-center space-x-2
          ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{notification.message}</span>
        </div>
      )}
    </AppContext.Provider>
  );
};

const useApp = () => {
  return useContext(AppContext);
};

// Dados simulados para o site
const experiences = [
  {
    id: 'exp1',
    name: 'Aventura na Floresta Amazônica',
    type: 'Natureza',
    duration: '7 dias',
    destination: 'Brasil - Amazonas',
    budget: 'R$ 3500',
    imageUrl: 'https://placehold.co/600x400/87CEEB/FFFFFF?text=Amazônia',
    description: 'Explore a rica biodiversidade da Floresta Amazônica, com trilhas, observação de animais e pernoite na selva.',
    rating: 4.8,
    reviews: 120,
    details: 'Roteiro completo: Dia 1: Chegada em Manaus e traslado para lodge. Dia 2-5: Trilhas, canoagem, pesca de piranhas, focagem noturna. Dia 6: Visita a comunidade ribeirinha. Dia 7: Retorno a Manaus. Inclusões: Transporte, refeições, guia especializado, seguro viagem. Exclusões: Passagens aéreas, despesas pessoais.'
  },
  {
    id: 'exp2',
    name: 'Cultura e Vinícolas no Vale do Loire',
    type: 'Cultural',
    duration: '5 dias',
    destination: 'Europa - França',
    budget: 'R$ 4800',
    imageUrl: 'https://placehold.co/600x400/ADD8E6/FFFFFF?text=Vale+do+Loire',
    description: 'Descubra os majestosos castelos e as renomadas vinícolas do Vale do Loire, na França.',
    rating: 4.5,
    reviews: 85,
    details: 'Roteiro completo: Dia 1: Chegada em Paris e traslado para Tours. Dia 2: Castelo de Chenonceau e degustação de vinhos. Dia 3: Castelo de Chambord e Blois. Dia 4: Visita a vinícolas e aula de culinária. Dia 5: Retorno a Paris. Inclusões: Transporte terrestre, hospedagem, degustações, guia. Exclusões: Passagens aéreas, refeições não mencionadas.'
  },
  {
    id: 'exp3',
    name: 'Gastronomia e Praias em Salvador',
    type: 'Gastronômica',
    duration: '4 dias',
    destination: 'Brasil - Bahia',
    budget: 'R$ 1800',
    imageUrl: 'https://placehold.co/600x400/90EE90/FFFFFF?text=Salvador',
    description: 'Uma imersão na culinária baiana e relaxamento nas belas praias de Salvador.',
    rating: 4.7,
    reviews: 95,
    details: 'Roteiro completo: Dia 1: Chegada em Salvador, Pelourinho e aula de culinária. Dia 2: Praias do Forte e Guarajuba. Dia 3: Mercado Modelo e Elevador Lacerda. Dia 4: Despedida. Inclusões: Hospedagem, algumas refeições, passeios. Exclusões: Passagens aéreas, bebidas.'
  },
  {
    id: 'exp4',
    name: 'Trilhas e Aventura na Patagônia',
    type: 'Aventura',
    duration: '8 dias',
    destination: 'América do Sul - Argentina/Chile',
    budget: 'R$ 6200',
    imageUrl: 'https://placehold.co/600x400/B0E0E6/FFFFFF?text=Patagônia',
    description: 'Desafie-se nas trilhas deslumbrantes da Patagônia, com paisagens de tirar o fôlego.',
    rating: 4.9,
    reviews: 150,
    details: 'Roteiro completo: Dia 1: Chegada em El Calafate. Dia 2: Perito Moreno. Dia 3-6: Trekking em El Chaltén. Dia 7: Retorno a El Calafate. Dia 8: Partida. Inclusões: Guias de trekking, transporte, hospedagem. Exclusões: Passagens aéreas, equipamentos pessoais.'
  },
  {
    id: 'exp5',
    name: 'Relaxamento e Bem-estar em Bali',
    type: 'Relaxamento',
    duration: '10 dias',
    destination: 'Internacional - Indonésia',
    budget: 'R$ 7500',
    imageUrl: 'https://placehold.co/600x400/C0C0C0/FFFFFF?text=Bali',
    description: 'Desfrute de retiros de yoga, spas e a serenidade das praias de Bali.',
    rating: 4.6,
    reviews: 110,
    details: 'Roteiro completo: Dia 1: Chegada em Denpasar e traslado para Ubud. Dia 2-4: Retiro de yoga, massagens, templos. Dia 5-9: Praias de Seminyak/Uluwatu, surf, relaxamento. Dia 10: Partida. Inclusões: Hospedagem, algumas atividades de bem-estar. Exclusões: Passagens aéreas, refeições não mencionadas.'
  },
  {
    id: 'exp6',
    name: 'Exploração Cultural em Tóquio',
    type: 'Cultural',
    duration: '6 dias',
    destination: 'Internacional - Japão',
    budget: 'R$ 5500',
    imageUrl: 'https://placehold.co/600x400/DDA0DD/FFFFFF?text=Tóquio',
    description: 'Mergulhe na vibrante cultura de Tóquio, desde templos antigos a bairros futuristas.',
    rating: 4.7,
    reviews: 90,
    details: 'Roteiro completo: Dia 1: Chegada em Tóquio, Shinjuku. Dia 2: Asakusa e Akihabara. Dia 3: Shibuya e Harajuku. Dia 4: Museu Ghibli e Ginza. Dia 5: Excursão a Hakone (Monte Fuji). Dia 6: Partida. Inclusões: Hospedagem, transporte público. Exclusões: Passagens aéreas, refeições.'
  },
];

const destinations = [
  { id: 'dest1', name: 'Amazônia, Brasil', imageUrl: 'https://placehold.co/400x300/87CEEB/FFFFFF?text=Amazônia', description: 'A maior floresta tropical do mundo.' },
  { id: 'dest2', name: 'Vale do Loire, França', imageUrl: 'https://placehold.co/400x300/ADD8E6/FFFFFF?text=Vale+do+Loire', description: 'Castelos e vinícolas históricas.' },
  { id: 'dest3', name: 'Salvador, Brasil', imageUrl: 'https://placehold.co/400x300/90EE90/FFFFFF?text=Salvador', description: 'Cultura e praias vibrantes.' },
  { id: 'dest4', name: 'Patagônia, Argentina/Chile', imageUrl: 'https://placehold.co/400x300/B0E0E6/FFFFFF?text=Patagônia', description: 'Paisagens montanhosas e glaciares.' },
  { id: 'dest5', name: 'Bali, Indonésia', imageUrl: 'https://placehold.co/400x300/C0C0C0/FFFFFF?text=Bali', description: 'Ilha da serenidade e bem-estar.' },
  { id: 'dest6', name: 'Tóquio, Japão', imageUrl: 'https://placehold.co/400x300/DDA0DD/FFFFFF?text=Tóquio', description: 'Metrópole futurista e rica em cultura.' },
];

// Componente de Notificação
const Notification = ({ message, type }) => (
  <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg flex items-center space-x-2
    ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
    {type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
    <span>{message}</span>
  </div>
);

// Componente do Card de Experiência
const ExperienceCard = ({ experience, onAddFavorite, onRemoveFavorite, isFavorite, onSelectExperience }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-transform duration-300 hover:scale-105 hover:shadow-xl relative">
      <img src={experience.imageUrl} alt={experience.name} className="w-full h-48 object-cover" onError={(e) => e.target.src = `https://placehold.co/600x400/CCCCCC/333333?text=${experience.name.replace(/ /g, '+')}`} />
      <div className="p-6">
        <h3 className="font-bold text-xl mb-2 text-gray-800">{experience.name}</h3>
        <p className="text-gray-600 text-sm mb-4">{experience.description}</p>
        <div className="flex items-center justify-between text-gray-700 text-sm mb-4">
          <span className="flex items-center">
            <Map size={16} className="mr-1 text-teal-500" /> {experience.destination}
          </span>
          <span className="flex items-center">
            <Compass size={16} className="mr-1 text-teal-500" /> {experience.duration}
          </span>
        </div>
        <div className="flex items-center justify-between text-gray-700 text-sm mb-4">
          <span className="font-semibold text-lg text-orange-600">{experience.budget}</span>
          <div className="flex items-center">
            <span className="text-yellow-500 mr-1">{'★'.repeat(Math.floor(experience.rating))}</span>
            <span className="text-gray-500">({experience.reviews})</span>
          </div>
        </div>
        <div className="flex justify-between items-center mt-4">
          <button
            onClick={() => onSelectExperience(experience)}
            className="bg-teal-500 text-white px-4 py-2 rounded-lg hover:bg-teal-600 transition-colors duration-300 shadow-md"
          >
            Ver Mais
          </button>
          <button
            onClick={() => isFavorite ? onRemoveFavorite(experience.id) : onAddFavorite(experience.id)}
            className={`p-2 rounded-full transition-colors duration-300
              ${isFavorite ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
            title={isFavorite ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
          >
            <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente da Página Individual da Experiência (Modal)
const ExperienceDetailModal = ({ experience, onClose, onAddFavorite, onRemoveFavorite, isFavorite }) => {
  if (!experience) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full p-8 relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">
          <X size={28} />
        </button>

        <h2 className="text-3xl font-bold text-gray-900 mb-4">{experience.name}</h2>
        <img src={experience.imageUrl} alt={experience.name} className="w-full h-64 object-cover rounded-lg mb-6" onError={(e) => e.target.src = `https://placehold.co/800x400/CCCCCC/333333?text=${experience.name.replace(/ /g, '+')}`} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Detalhes da Experiência</h3>
            <p className="text-gray-700 mb-2">{experience.description}</p>
            <p className="text-gray-600 flex items-center mb-1"><Map size={18} className="mr-2 text-teal-600" /> Destino: {experience.destination}</p>
            <p className="text-gray-600 flex items-center mb-1"><Compass size={18} className="mr-2 text-teal-600" /> Duração: {experience.duration}</p>
            <p className="text-gray-600 flex items-center mb-1"><User size={18} className="mr-2 text-teal-600" /> Tipo: {experience.type}</p>
            <p className="text-gray-600 flex items-center mb-1"><BookOpen size={18} className="mr-2 text-teal-600" /> Orçamento Estimado: <span className="font-bold text-orange-600 ml-1">{experience.budget}</span></p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Avaliações</h3>
            <div className="flex items-center mb-2">
              <span className="text-yellow-500 text-2xl mr-2">{'★'.repeat(Math.floor(experience.rating))}</span>
              <span className="text-gray-700 text-lg font-semibold">{experience.rating} / 5</span>
              <span className="text-gray-500 ml-2">({experience.reviews} avaliações)</span>
            </div>
            <p className="text-gray-600 italic">"Uma experiência inesquecível! Recomendo a todos." - Viajante Satisfeito</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-gray-800 mb-2">Roteiro Completo</h3>
        <p className="text-gray-700 mb-6">{experience.details}</p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
          <button className="bg-orange-500 text-white px-8 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-300 shadow-lg text-lg font-semibold">
            Reservar Agora
          </button>
          <button
            onClick={() => isFavorite ? onRemoveFavorite(experience.id) : onAddFavorite(experience.id)}
            className={`flex items-center justify-center px-8 py-3 rounded-lg transition-colors duration-300 shadow-lg text-lg font-semibold
              ${isFavorite ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-teal-500 text-white hover:bg-teal-600'}`}
          >
            <Heart size={20} className="mr-2" fill={isFavorite ? 'currentColor' : 'none'} />
            {isFavorite ? 'Remover da Minha Viagem' : 'Adicionar à Minha Viagem'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente da Página Inicial
const HomePage = ({ onSelectExperience }) => {
  const { addFavorite, removeFavorite, userFavorites, showNotification } = useApp();
  const [newsletterEmail, setNewsletterEmail] = useState('');

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    if (newsletterEmail) {
      // Simulate newsletter subscription
      console.log('Assinatura de newsletter:', newsletterEmail);
      showNotification('Obrigado por assinar nossa newsletter!', 'success');
      setNewsletterEmail('');
    } else {
      showNotification('Por favor, insira um e-mail válido.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Hero Section */}
      <section
        className="relative h-[60vh] bg-cover bg-center flex items-center justify-center text-white p-4 rounded-b-3xl shadow-lg"
        style={{ backgroundImage: 'url(https://placehold.co/1920x1080/4ECDC4/FFFFFF?text=VivaMais+Turismo)' }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-teal-800 to-transparent opacity-70 rounded-b-3xl"></div>
        <div className="relative z-10 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 leading-tight drop-shadow-lg">
            Viva Novas Histórias. Viaje VivaMais.
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-2xl mx-auto drop-shadow-md">
            Sua jornada começa aqui. Descubra destinos incríveis e experiências inesquecíveis.
          </p>
          <button className="bg-orange-500 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-orange-600 transition-all duration-300 shadow-xl transform hover:scale-105">
            Simule Sua Viagem Agora!
          </button>
        </div>
      </section>

      {/* Experiências em Destaque */}
      <section className="py-16 px-4 md:px-8 lg:px-16">
        <h2 className="text-4xl font-bold text-center text-gray-800 mb-12">Experiências em Destaque</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {experiences.slice(0, 3).map((exp) => (
            <ExperienceCard
              key={exp.id}
              experience={exp}
              onAddFavorite={addFavorite}
              onRemoveFavorite={removeFavorite}
              isFavorite={userFavorites.includes(exp.id)}
              onSelectExperience={onSelectExperience}
            />
          ))}
        </div>
        <div className="text-center mt-12">
          <button className="bg-teal-500 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-teal-600 transition-all duration-300 shadow-xl transform hover:scale-105">
            Ver Todas as Experiências
          </button>
        </div>
      </section>

      {/* Publicidade em Destaque */}
      <section className="py-16 px-4 md:px-8 lg:px-16 bg-gradient-to-r from-blue-200 to-teal-200 rounded-xl shadow-lg my-16">
        <h2 className="text-4xl font-bold text-center text-gray-800 mb-12">Publicidade em Destaque</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-transform duration-300 hover:scale-105">
            <img src="https://placehold.co/800x400/FFD700/333333?text=Desconto+Exclusivo+Paris" alt="Anúncio de Desconto para Paris" className="w-full h-64 object-cover" />
            <div className="p-6 text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Desconto Exclusivo: Paris Romântica!</h3>
              <p className="text-gray-600 mb-4">Aproveite 20% de desconto em pacotes selecionados para a Cidade Luz. Válido até 30/06.</p>
              <button className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-300 shadow-md">
                Saiba Mais
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-transform duration-300 hover:scale-105">
            <img src="https://placehold.co/800x400/90EE90/333333?text=Aventura+no+Pantanal" alt="Anúncio de Aventura no Pantanal" className="w-full h-64 object-cover" />
            <div className="p-6 text-center">
              <h3 className="text-2xl font-bold text-gray-800 mb-2">Aventura Inesquecível no Pantanal!</h3>
              <p className="text-gray-600 mb-4">Descubra a vida selvagem e a natureza exuberante do Pantanal. Pacotes com tudo incluso!</p>
              <button className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-300 shadow-md">
                Ver Pacotes
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Simulation Filter (Placeholder) */}
      <section className="bg-blue-100 py-16 px-4 md:px-8 lg:px-16 rounded-t-3xl">
        <h2 className="text-4xl font-bold text-center text-gray-800 mb-12">Planeje Sua Viagem Rápido</h2>
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-around space-y-6 md:space-y-0 md:space-x-6">
          <input
            type="text"
            placeholder="Escolha um destino..."
            className="w-full md:w-1/3 p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <select className="w-full md:w-1/3 p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
            <option value="">Tipo de experiência...</option>
            <option value="natureza">Natureza</option>
            <option value="cultural">Cultural</option>
            <option value="gastronomica">Gastronômica</option>
            <option value="aventura">Aventura</option>
            <option value="relaxamento">Relaxamento</option>
          </select>
          <button className="w-full md:w-1/4 bg-orange-500 text-white px-6 py-4 rounded-lg font-semibold hover:bg-orange-600 transition-colors duration-300 shadow-md">
            Buscar
          </button>
        </div>
      </section>

      {/* Promoções e Pacotes Especiais */}
      <section className="py-16 px-4 md:px-8 lg:px-16 bg-gray-50">
        <h2 className="text-4xl font-bold text-center text-gray-800 mb-12">Promoções e Pacotes Especiais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {experiences.slice(3, 6).map((exp) => (
            <ExperienceCard
              key={exp.id}
              experience={exp}
              onAddFavorite={addFavorite}
              onRemoveFavorite={removeFavorite}
              isFavorite={userFavorites.includes(exp.id)}
              onSelectExperience={onSelectExperience}
            />
          ))}
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="py-16 px-4 md:px-8 lg:px-16 bg-gradient-to-r from-teal-500 to-blue-500 text-white rounded-xl shadow-lg my-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">Assine Nossa Newsletter!</h2>
          <p className="text-xl mb-8 opacity-90">Receba as últimas notícias, ofertas exclusivas e dicas de viagem diretamente na sua caixa de entrada.</p>
          <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-4 justify-center">
            <input
              type="email"
              placeholder="Seu melhor e-mail..."
              className="w-full sm:w-2/3 p-4 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
              value={newsletterEmail}
              onChange={(e) => setNewsletterEmail(e.target.value)}
              required
            />
            <button
              type="submit"
              className="bg-orange-500 text-white px-8 py-4 rounded-lg font-semibold hover:bg-orange-600 transition-colors duration-300 shadow-md flex items-center justify-center sm:w-1/3"
            >
              <Send size={20} className="mr-2" /> Assinar
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

// Componente da Página de Destinos
const DestinationsPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 md:px-8 lg:px-16">
      <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">Nossos Destinos Incríveis</h1>
      <p className="text-center text-lg text-gray-600 mb-10 max-w-3xl mx-auto">
        Explore uma vasta gama de destinos nacionais e internacionais, cada um com sua própria beleza e aventura esperando por você.
      </p>

      {/* Mapa Interativo (Placeholder) */}
      <div className="bg-blue-100 h-96 rounded-xl shadow-lg flex items-center justify-center mb-12 text-gray-700 text-xl font-semibold">
        [Image of Interactive Map Placeholder]
        Mapa Interativo (Leaflet.js ou similar)
      </div>

      {/* Filtros de Destinos (Placeholder) */}
      <div className="flex flex-wrap justify-center gap-4 mb-12">
        <select className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Filtrar por Região</option>
          <option value="brasil">Brasil</option>
          <option value="america-sul">América do Sul</option>
          <option value="europa">Europa</option>
          <option value="asia">Ásia</option>
        </select>
        <select className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Filtrar por Clima</option>
          <option value="tropical">Tropical</option>
          <option value="temperado">Temperado</option>
          <option value="deserto">Deserto</option>
        </select>
        <select className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Filtrar por Temática</option>
          <option value="praia">Praia</option>
          <option value="montanha">Montanha</option>
          <option value="cidade">Cidade</option>
          <option value="natureza">Natureza</option>
        </select>
      </div>

      {/* Cards de Destinos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {destinations.map((dest) => (
          <div key={dest.id} className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-transform duration-300 hover:scale-105 hover:shadow-xl">
            <img src={dest.imageUrl} alt={dest.name} className="w-full h-56 object-cover" onError={(e) => e.target.src = `https://placehold.co/400x300/CCCCCC/333333?text=${dest.name.replace(/ /g, '+')}`} />
            <div className="p-6">
              <h3 className="font-bold text-2xl mb-2 text-gray-800">{dest.name}</h3>
              <p className="text-gray-600 text-base">{dest.description}</p>
              <button className="mt-4 bg-teal-500 text-white px-6 py-3 rounded-lg hover:bg-teal-600 transition-colors duration-300 shadow-md">
                Ver Experiências
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Componente da Página de Experiências
const ExperiencesPage = ({ onSelectExperience }) => {
  const { addFavorite, removeFavorite, userFavorites } = useApp();
  const [filters, setFilters] = useState({ type: '', duration: '', budget: '', difficulty: '' });

  const filteredExperiences = experiences.filter(exp => {
    return (
      (filters.type === '' || exp.type.toLowerCase() === filters.type.toLowerCase()) &&
      (filters.duration === '' || exp.duration.toLowerCase().includes(filters.duration.toLowerCase())) &&
      (filters.budget === '' || exp.budget.includes(filters.budget)) &&
      (filters.difficulty === '' || exp.details.toLowerCase().includes(filters.difficulty.toLowerCase()))
    );
  });

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 md:px-8 lg:px-16">
      <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">Nosso Catálogo de Experiências</h1>
      <p className="text-center text-lg text-gray-600 mb-10 max-w-3xl mx-auto">
        Encontre a aventura perfeita para você, com opções que se encaixam em todos os gostos e orçamentos.
      </p>

      {/* Filtros Avançados */}
      <div className="max-w-5xl mx-auto bg-white p-8 rounded-2xl shadow-xl mb-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <select name="type" onChange={handleFilterChange} value={filters.type} className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Tipo de experiência</option>
          <option value="natureza">Natureza</option>
          <option value="cultural">Cultural</option>
          <option value="gastronomica">Gastronômica</option>
          <option value="aventura">Aventura</option>
          <option value="relaxamento">Relaxamento</option>
        </select>
        <select name="duration" onChange={handleFilterChange} value={filters.duration} className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Duração</option>
          <option value="1 dia">1 dia</option>
          <option value="fim de semana">Fim de semana</option>
          <option value="5 dias">5 dias</option>
          <option value="7 dias">7 dias</option>
          <option value="10 dias">10 dias</option>
        </select>
        <select name="budget" onChange={handleFilterChange} value={filters.budget} className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Orçamento Estimado</option>
          <option value="R$ 1800">Até R$ 2000</option>
          <option value="R$ 3500">R$ 2000 - R$ 4000</option>
          <option value="R$ 4800">R$ 4000 - R$ 6000</option>
          <option value="R$ 6200">Acima de R$ 6000</option>
        </select>
        <select name="difficulty" onChange={handleFilterChange} value={filters.difficulty} className="p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500">
          <option value="">Nível de Dificuldade</option>
          <option value="fácil">Fácil</option>
          <option value="moderado">Moderado</option>
          <option value="difícil">Difícil</option>
        </select>
      </div>

      {/* Grid de Experiências */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredExperiences.length > 0 ? (
          filteredExperiences.map((exp) => (
            <ExperienceCard
              key={exp.id}
              experience={exp}
              onAddFavorite={addFavorite}
              onRemoveFavorite={removeFavorite}
              isFavorite={userFavorites.includes(exp.id)}
              onSelectExperience={onSelectExperience}
            />
          ))
        ) : (
          <p className="col-span-full text-center text-gray-600 text-xl">Nenhuma experiência encontrada com os filtros selecionados.</p>
        )}
      </div>
    </div>
  );
};

// Componente do Simulador de Roteiros (Simplificado)
const SimulatorPage = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    destination: '',
    date: '',
    preferences: [],
    travelerProfile: '',
    budget: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handlePreferenceChange = (e) => {
    const { value, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      preferences: checked
        ? [...prev.preferences, value]
        : prev.preferences.filter(pref => pref !== value)
    }));
  };

  const nextStep = () => setStep(step + 1);
  const prevStep = () => setStep(step - 1);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Replaced alert with showNotification
    showNotification('Simulação de roteiro enviada! Entraremos em contato em breve.', 'success');
    setStep(1); // Reset form
    setFormData({
      destination: '',
      date: '',
      preferences: [],
      travelerProfile: '',
      budget: '',
    });
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-2xl font-semibold text-gray-800">Passo 1: Destino e Data</h3>
            <div>
              <label htmlFor="destination" className="block text-gray-700 font-medium mb-2">Destino(s) da Viagem:</label>
              <input
                type="text"
                id="destination"
                name="destination"
                value={formData.destination}
                onChange={handleChange}
                placeholder="Ex: Paris, Rio de Janeiro"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label htmlFor="date" className="block text-gray-700 font-medium mb-2">Data da Viagem:</label>
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <button onClick={nextStep} className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-300 shadow-md">
              Próximo
            </button>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-2xl font-semibold text-gray-800">Passo 2: Preferências</h3>
            <div>
              <label className="block text-gray-700 font-medium mb-2">Tipo de Passeio:</label>
              <div className="grid grid-cols-2 gap-4">
                {['Natureza', 'Cultural', 'Gastronômica', 'Aventura', 'Relaxamento'].map(pref => (
                  <label key={pref} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="preferences"
                      value={pref}
                      checked={formData.preferences.includes(pref)}
                      onChange={handlePreferenceChange}
                      className="form-checkbox text-teal-500 rounded"
                    />
                    <span>{pref}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="travelerProfile" className="block text-gray-700 font-medium mb-2">Perfil de Viajante:</label>
              <select
                id="travelerProfile"
                name="travelerProfile"
                value={formData.travelerProfile}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              >
                <option value="">Selecione...</option>
                <option value="família">Família</option>
                <option value="casal">Casal</option>
                <option value="solo">Solo</option>
                <option value="aventura">Aventura</option>
              </select>
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className="bg-gray-300 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-400 transition-colors duration-300 shadow-md">
                Anterior
              </button>
              <button onClick={nextStep} className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors duration-300 shadow-md">
                Próximo
              </button>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <h3 className="text-2xl font-semibold text-gray-800">Passo 3: Orçamento</h3>
            <div>
              <label htmlFor="budget" className="block text-gray-700 font-medium mb-2">Orçamento Total ou por Pessoa:</label>
              <input
                type="text"
                id="budget"
                name="budget"
                value={formData.budget}
                onChange={handleChange}
                placeholder="Ex: R$ 5000 por pessoa, R$ 10000 total"
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className="bg-gray-300 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-400 transition-colors duration-300 shadow-md">
                Anterior
              </button>
              <button type="submit" className="bg-teal-500 text-white px-6 py-3 rounded-lg hover:bg-teal-600 transition-colors duration-300 shadow-md">
                Gerar Roteiro
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 md:px-8 lg:px-16">
      <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">Simule Seu Roteiro Personalizado</h1>
      <p className="text-center text-lg text-gray-600 mb-10 max-w-3xl mx-auto">
        Crie a viagem dos seus sonhos passo a passo, adaptada às suas preferências e orçamento.
      </p>

      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-xl">
        {/* Barra de Progresso */}
        <div className="mb-8">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-teal-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>Destino</span>
            <span>Preferências</span>
            <span>Orçamento</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {renderStep()}
        </form>

        {/* Resultados (Placeholder) */}
        {step === 3 && (
          <div className="mt-12 p-6 bg-blue-50 rounded-lg border border-blue-200 text-gray-700">
            <h3 className="text-2xl font-semibold text-gray-800 mb-4">Roteiro Sugerido (Exemplo)</h3>
            <p className="mb-2"><strong>Destino:</strong> {formData.destination || 'Não informado'}</p>
            <p className="mb-2"><strong>Data:</strong> {formData.date || 'Não informado'}</p>
            <p className="mb-2"><strong>Preferências:</strong> {formData.preferences.join(', ') || 'Nenhuma'}</p>
            <p className="mb-4"><strong>Orçamento:</strong> {formData.budget || 'Não informado'}</p>
            <p className="text-lg font-medium text-teal-600">
              Seu roteiro personalizado está sendo gerado! Um especialista entrará em contato com as melhores opções.
            </p>
            <div className="mt-4 text-center">
              [Image of Interactive Map Placeholder]
              <div className="bg-gray-200 h-48 flex items-center justify-center rounded-lg mt-4">Mapa Interativo do Roteiro</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente da Área do Usuário
const UserAreaPage = () => {
  const { userId, isAuthReady, userFavorites, handleLogout } = useApp();

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 md:px-8 lg:px-16">
      <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">Minha Viagem</h1>
      <p className="text-center text-lg text-gray-600 mb-10 max-w-3xl mx-auto">
        Bem-vindo à sua área personalizada. Aqui você pode gerenciar suas viagens, favoritos e orçamentos.
      </p>

      <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-xl">
        {isAuthReady ? (
          <>
            <div className="mb-8 text-center">
              <p className="text-gray-700 text-lg mb-2">Seu ID de Usuário:</p>
              <p className="font-mono bg-gray-100 p-3 rounded-lg text-gray-800 break-all">{userId}</p>
              <p className="text-sm text-gray-500 mt-2">Compartilhe este ID para que outros usuários possam te encontrar em aplicativos colaborativos.</p>
            </div>

            <h2 className="text-3xl font-bold text-gray-800 mb-6">Minhas Experiências Favoritas</h2>
            {userFavorites.length > 0 ? (
              <ul className="space-y-4">
                {userFavorites.map((favId) => {
                  const experience = experiences.find(exp => exp.id === favId);
                  return experience ? (
                    <li key={favId} className="bg-blue-50 p-4 rounded-lg shadow-sm flex items-center justify-between">
                      <span className="text-lg font-semibold text-gray-700">{experience.name}</span>
                      <span className="text-sm text-gray-500">{experience.destination}</span>
                    </li>
                  ) : (
                    <li key={favId} className="bg-blue-50 p-4 rounded-lg shadow-sm text-gray-500">
                      Experiência ID: {favId} (Detalhes não encontrados)
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-gray-600 italic">Você ainda não adicionou nenhuma experiência aos favoritos.</p>
            )}

            <h2 className="text-3xl font-bold text-gray-800 mt-10 mb-6">Meus Orçamentos (Em Breve)</h2>
            <p className="text-gray-600 italic">
              Seu histórico de solicitações de orçamento aparecerá aqui.
            </p>

            <h2 className="text-3xl font-bold text-gray-800 mt-10 mb-6">Alertas Personalizados (Em Breve)</h2>
            <p className="text-gray-600 italic">
              Receba notificações sobre promoções e eventos nos seus destinos favoritos.
            </p>

            <div className="mt-12 text-center">
              <button
                onClick={handleLogout}
                className="bg-red-500 text-white px-8 py-3 rounded-lg hover:bg-red-600 transition-colors duration-300 shadow-md flex items-center justify-center mx-auto"
              >
                <LogOut size={20} className="mr-2" /> Sair
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 size={48} className="animate-spin text-teal-500 mb-4" />
            <p className="text-xl text-gray-600">Carregando sua área de usuário...</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Componente Sobre Nós
const AboutUsPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 md:px-8 lg:px-16">
      <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">Sobre Nós</h1>
      <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-xl text-gray-700 leading-relaxed">
        <h2 className="text-3xl font-semibold text-teal-600 mb-4">Nossa História</h2>
        <p className="mb-6">
          A VivaMais Turismo nasceu da paixão por viagens e do desejo de transformar sonhos em realidade. Fundada em 2023, nossa missão é oferecer experiências turísticas inesquecíveis, com foco na personalização e na qualidade do atendimento. Acreditamos que cada viagem é uma nova história a ser vivida, e estamos aqui para garantir que a sua seja extraordinária.
        </p>

        <h2 className="text-3xl font-semibold text-teal-600 mb-4">Nossa Equipe</h2>
        <p className="mb-6">
          Somos um time de especialistas apaixonados por descobrir o mundo e compartilhar suas maravilhas. Com anos de experiência no setor de turismo, nossa equipe está sempre pronta para criar roteiros sob medida, oferecer as melhores dicas e garantir que cada detalhe da sua viagem seja perfeito.
        </p>

        <h2 className="text-3xl font-semibold text-teal-600 mb-4">Missão e Visão</h2>
        <p className="mb-2">
          <span className="font-bold">Missão:</span> Inspirar, planejar e facilitar viagens e experiências de lazer, proporcionando momentos únicos e memórias duradouras, com excelência e paixão.
        </p>
        <p>
          <span className="font-bold">Visão:</span> Ser a principal referência em turismo personalizado, reconhecida pela inovação, qualidade dos serviços e pela capacidade de conectar pessoas a destinos e culturas de forma autêntica e sustentável.
        </p>
      </div>
    </div>
  );
};

// Componente Blog/Guia de Viagem
const BlogPage = () => {
  const articles = [
    {
      id: 'blog1',
      title: '10 Dicas Essenciais para Viajar para a Amazônia',
      imageUrl: 'https://placehold.co/600x400/87CEEB/FFFFFF?text=Dicas+Amazônia',
      excerpt: 'Prepare-se para sua aventura na maior floresta tropical do mundo com estas dicas valiosas.',
      date: '15 de Maio de 2025',
      category: 'Dicas',
    },
    {
      id: 'blog2',
      title: 'Descobrindo a Magia dos Castelos do Vale do Loire',
      imageUrl: 'https://placehold.co/600x400/ADD8E6/FFFFFF?text=Castelos+Loire',
      excerpt: 'Um guia completo para explorar a história e a beleza dos castelos franceses.',
      date: '10 de Maio de 2025',
      category: 'Roteiros Prontos',
    },
    {
      id: 'blog3',
      title: 'Segurança em Viagens: O Que Você Precisa Saber',
      imageUrl: 'https://placehold.co/600x400/FFD700/FFFFFF?text=Segurança+Viagem',
      excerpt: 'Mantenha-se seguro em suas aventuras com nossas dicas de segurança em viagens.',
      date: '05 de Maio de 2025',
      category: 'Segurança',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 md:px-8 lg:px-16">
      <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">Nosso Blog e Guia de Viagem</h1>
      <p className="text-center text-lg text-gray-600 mb-10 max-w-3xl mx-auto">
        Encontre artigos inspiradores, dicas de viagem, roteiros e informações essenciais para planejar sua próxima aventura.
      </p>

      {/* Categorias (Placeholder) */}
      <div className="flex flex-wrap justify-center gap-4 mb-12">
        <button className="bg-teal-100 text-teal-800 px-6 py-2 rounded-full hover:bg-teal-200 transition-colors duration-300">Dicas</button>
        <button className="bg-teal-100 text-teal-800 px-6 py-2 rounded-full hover:bg-teal-200 transition-colors duration-300">Roteiros Prontos</button>
        <button className="bg-teal-100 text-teal-800 px-6 py-2 rounded-full hover:bg-teal-200 transition-colors duration-300">Segurança</button>
        <button className="bg-teal-100 text-teal-800 px-6 py-2 rounded-full hover:bg-teal-200 transition-colors duration-300">Épocas Ideais</button>
      </div>

      {/* Artigos do Blog */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {articles.map((article) => (
          <div key={article.id} className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-transform duration-300 hover:scale-105 hover:shadow-xl">
            <img src={article.imageUrl} alt={article.title} className="w-full h-48 object-cover" onError={(e) => e.target.src = `https://placehold.co/600x400/CCCCCC/333333?text=${article.title.replace(/ /g, '+')}`} />
            <div className="p-6">
              <h3 className="font-bold text-2xl mb-2 text-gray-800">{article.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{article.excerpt}</p>
              <div className="flex items-center justify-between text-gray-500 text-xs">
                <span>{article.date}</span>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-semibold">{article.category}</span>
              </div>
              <button className="mt-4 bg-teal-500 text-white px-6 py-3 rounded-lg hover:bg-teal-600 transition-colors duration-300 shadow-md">
                Ler Mais
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Componente de Contato
const ContactPage = () => {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const { showNotification } = useApp();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Simulação de envio de formulário
    console.log('Formulário de contato enviado:', formData);
    showNotification('Sua mensagem foi enviada com sucesso!', 'success');
    setFormData({ name: '', email: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-16 px-4 md:px-8 lg:px-16">
      <h1 className="text-4xl font-bold text-center text-gray-800 mb-12">Entre em Contato</h1>
      <p className="text-center text-lg text-gray-600 mb-10 max-w-3xl mx-auto">
        Estamos aqui para ajudar! Preencha o formulário ou utilize nossos canais diretos de atendimento.
      </p>

      <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-gray-700 font-medium mb-2">Nome:</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-gray-700 font-medium mb-2">E-mail:</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            />
          </div>
          <div>
            <label htmlFor="message" className="block text-gray-700 font-medium mb-2">Mensagem:</label>
            <textarea
              id="message"
              name="message"
              value={formData.message}
              onChange={handleChange}
              rows="5"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              required
            ></textarea>
          </div>
          {/* reCAPTCHA Placeholder */}
          <div className="bg-gray-100 p-4 rounded-lg text-center text-gray-600">
            [Image of reCAPTCHA Placeholder]
            reCAPTCHA aqui
          </div>
          <button
            type="submit"
            className="w-full bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition-colors duration-300 shadow-md"
          >
            Enviar Mensagem
          </button>
        </form>

        <div className="mt-10 text-center space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800">Canais de Atendimento Direto</h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <a
              href="https://wa.me/5511999999999" // Exemplo de número de WhatsApp
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors duration-300 shadow-md flex items-center justify-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-whatsapp mr-2"><path d="M10.82 10.82a4.34 4.34 0 0 1 5.42 5.42L18 18l1.35 1.35a1 1 0 0 0 1.41 0l1.42-1.42a1 1 0 0 0 0-1.41L20.4 16.4l-1.2-1.2a4.34 4.34 0 0 1-5.42-5.42l-1.2-1.2L4.65 3.24a1 1 0 0 0-1.41 0L1.82 4.66a1 1 0 0 0 0 1.41L3.24 7.35l1.2 1.2a4.34 4.34 0 0 1 5.42 5.42l1.2 1.2L16.4 20.4a1 1 0 0 0 1.41 0l1.42-1.42a1 1 0 0 0 0-1.41L18 18l-1.35-1.35a4.34 4.34 0 0 1-5.42-5.42L10.82 10.82Z"></path><path d="M19.07 19.07a10 10 0 0 1-16.94-2.83L2 19l2.83-1.07A10 10 0 0 1 19.07 19.07Z"></path></svg>
              WhatsApp
            </a>
            <a
              href="mailto:contato@vivamaisturismo.com"
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors duration-300 shadow-md flex items-center justify-center"
            >
              <Mail size={20} className="mr-2" />
              E-mail
            </a>
            <button className="bg-gray-700 text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors duration-300 shadow-md flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle-code mr-2"><path d="M7.9 20A9 9 0 0 1 4 16.1L2 22Z"/><path d="M10 10h.01"/><path d="M14 10h.01"/><path d="M18 10h.01"/><path d="M10 14h.01"/><path d="M14 14h.01"/><path d="M18 14h.01"/><path d="M22 12a10 10 0 0 0-10-10A10 10 0 0 0 2 12c0 2.5.9 4.8 2.4 6.5"/></svg>
              Chat Online
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};


// Componente principal do App
const App = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedExperience, setSelectedExperience] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSelectExperience = (experience) => {
    setSelectedExperience(experience);
  };

  const handleCloseExperienceModal = () => {
    setSelectedExperience(null);
  };

  const { addFavorite, removeFavorite, userFavorites } = useApp();

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onSelectExperience={handleSelectExperience} />;
      case 'destinos':
        return <DestinationsPage />;
      case 'experiencias':
        return <ExperiencesPage onSelectExperience={handleSelectExperience} />;
      case 'simulador':
        return <SimulatorPage />;
      case 'sobre-nos':
        return <AboutUsPage />;
      case 'blog':
        return <BlogPage />;
      case 'contato':
        return <ContactPage />;
      case 'minha-viagem':
        return <UserAreaPage />;
      default:
        return <HomePage onSelectExperience={handleSelectExperience} />;
    }
  };

  return (
    <div className="font-['Poppins']">
      {/* Tailwind CSS CDN */}
      <script src="https://cdn.tailwindcss.com"></script>
      {/* Font Awesome CDN (for WhatsApp icon example) */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" xintegrity="sha512-Fo3rlrZj/k7ujTnHg4CGR2D7kSs0pReXg/v+x1/L2Q5t2h4/0/g0f8+Pz/o75g8X+7z2q5w+7z2q5w==" crossOrigin="anonymous" referrerPolicy="no-referrer" />

      {/* Navbar */}
      <nav className="bg-white shadow-md p-4 sticky top-0 z-40 rounded-b-xl">
        <div className="container mx-auto flex justify-between items-center">
          <div className="text-2xl font-bold text-teal-600">
            VivaMais Turismo
          </div>
          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-700 focus:outline-none">
              {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
          {/* Desktop Navigation */}
          <ul className="hidden md:flex space-x-8 text-gray-700 font-medium">
            <li><button onClick={() => setCurrentPage('home')} className="hover:text-teal-600 transition-colors duration-200 flex items-center"><Home size={18} className="mr-1" /> Home</button></li>
            <li><button onClick={() => setCurrentPage('destinos')} className="hover:text-teal-600 transition-colors duration-200 flex items-center"><Map size={18} className="mr-1" /> Destinos</button></li>
            <li><button onClick={() => setCurrentPage('experiencias')} className="hover:text-teal-600 transition-colors duration-200 flex items-center"><Compass size={18} className="mr-1" /> Experiências</button></li>
            <li><button onClick={() => setCurrentPage('simulador')} className="hover:text-teal-600 transition-colors duration-200 flex items-center"><LayoutDashboard size={18} className="mr-1" /> Simule Sua Viagem</button></li>
            <li><button onClick={() => setCurrentPage('sobre-nos')} className="hover:text-teal-600 transition-colors duration-200 flex items-center"><User size={18} className="mr-1" /> Sobre Nós</button></li>
            <li><button onClick={() => setCurrentPage('blog')} className="hover:text-teal-600 transition-colors duration-200 flex items-center"><BookOpen size={18} className="mr-1" /> Blog</button></li>
            <li><button onClick={() => setCurrentPage('contato')} className="hover:text-teal-600 transition-colors duration-200 flex items-center"><Mail size={18} className="mr-1" /> Contato</button></li>
            <li><button onClick={() => setCurrentPage('minha-viagem')} className="hover:text-teal-600 transition-colors duration-200 flex items-center"><User size={18} className="mr-1" /> Minha Viagem</button></li>
          </ul>
        </div>
        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4">
            <ul className="flex flex-col space-y-2 text-gray-700 font-medium">
              <li><button onClick={() => { setCurrentPage('home'); setIsMobileMenuOpen(false); }} className="block w-full text-left py-2 px-4 hover:bg-gray-100 rounded-lg flex items-center"><Home size={18} className="mr-2" /> Home</button></li>
              <li><button onClick={() => { setCurrentPage('destinos'); setIsMobileMenuOpen(false); }} className="block w-full text-left py-2 px-4 hover:bg-gray-100 rounded-lg flex items-center"><Map size={18} className="mr-2" /> Destinos</button></li>
              <li><button onClick={() => { setCurrentPage('experiencias'); setIsMobileMenuOpen(false); }} className="block w-full text-left py-2 px-4 hover:bg-gray-100 rounded-lg flex items-center"><Compass size={18} className="mr-2" /> Experiências</button></li>
              <li><button onClick={() => { setCurrentPage('simulador'); setIsMobileMenuOpen(false); }} className="block w-full text-left py-2 px-4 hover:bg-gray-100 rounded-lg flex items-center"><LayoutDashboard size={18} className="mr-2" /> Simule Sua Viagem</button></li>
              <li><button onClick={() => { setCurrentPage('sobre-nos'); setIsMobileMenuOpen(false); }} className="block w-full text-left py-2 px-4 hover:bg-gray-100 rounded-lg flex items-center"><User size={18} className="mr-2" /> Sobre Nós</button></li>
              <li><button onClick={() => { setCurrentPage('blog'); setIsMobileMenuOpen(false); }} className="block w-full text-left py-2 px-4 hover:bg-gray-100 rounded-lg flex items-center"><BookOpen size={18} className="mr-2" /> Blog</button></li>
              <li><button onClick={() => { setCurrentPage('contato'); setIsMobileMenuOpen(false); }} className="block w-full text-left py-2 px-4 hover:bg-gray-100 rounded-lg flex items-center"><Mail size={18} className="mr-2" /> Contato</button></li>
              <li><button onClick={() => { setCurrentPage('minha-viagem'); setIsMobileMenuOpen(false); }} className="block w-full text-left py-2 px-4 hover:bg-gray-100 rounded-lg flex items-center"><User size={18} className="mr-2" /> Minha Viagem</button></li>
            </ul>
          </div>
        )}
      </nav>

      {renderPage()}

      {/* Experience Detail Modal */}
      {selectedExperience && (
        <ExperienceDetailModal
          experience={selectedExperience}
          onClose={handleCloseExperienceModal}
          onAddFavorite={addFavorite}
          onRemoveFavorite={removeFavorite}
          isFavorite={userFavorites.includes(selectedExperience.id)}
        />
      )}

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-12 px-4 md:px-8 lg:px-16 rounded-t-3xl">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="text-2xl font-bold text-teal-400 mb-4">VivaMais Turismo</h3>
            <p className="text-gray-400">Sua jornada começa aqui. Descubra destinos incríveis e experiências inesquecíveis.</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-teal-400 mb-4">Links Rápidos</h3>
            <ul className="space-y-2">
              <li><button onClick={() => setCurrentPage('home')} className="text-gray-400 hover:text-white transition-colors duration-200">Home</button></li>
              <li><button onClick={() => setCurrentPage('destinos')} className="text-gray-400 hover:text-white transition-colors duration-200">Destinos</button></li>
              <li><button onClick={() => setCurrentPage('experiencias')} className="text-gray-400 hover:text-white transition-colors duration-200">Experiências</button></li>
              <li><button onClick={() => setCurrentPage('simulador')} className="text-gray-400 hover:text-white transition-colors duration-200">Simule Sua Viagem</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-teal-400 mb-4">Contato</h3>
            <p className="text-gray-400 mb-2">E-mail: contato@vivamaisturismo.com</p>
            <p className="text-gray-400 mb-2">Telefone: (XX) XXXX-XXXX</p>
            <div className="flex space-x-4 mt-4">
              <a href="#" className="text-gray-400 hover:text-white"><i className="fab fa-facebook-f"></i></a>
              <a href="#" className="text-gray-400 hover:text-white"><i className="fab fa-instagram"></i></a>
              <a href="#" className="text-gray-400 hover:text-white"><i className="fab fa-twitter"></i></a>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-500">
          &copy; {new Date().getFullYear()} VivaMais Turismo. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};

// Export the App component wrapped in the AppProvider
export default function ProvidedApp() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}
