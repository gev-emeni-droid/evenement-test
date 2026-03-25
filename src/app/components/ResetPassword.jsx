import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    setError('');

    if (!token) {
      setError('Lien invalide ou expiré. Veuillez refaire une demande de réinitialisation.');
      return;
    }
    if (!password || !confirm) {
      setError('Merci de saisir et confirmer le nouveau mot de passe.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const resp = await fetch('https://polpo-auth-worker.gev-emeni.workers.dev/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword: password }),
      });

      if (!resp.ok) {
        const data = await resp.json().catch(() => null);
        const msg = data && data.error ? data.error : 'Une erreur est survenue. Veuillez réessayer.';
        setError(msg);
        setLoading(false);
        return;
      }

      setStatus('Votre mot de passe a bien été mis à jour. Vous pouvez maintenant vous connecter.');
      setLoading(false);
    } catch (err) {
      setError('Une erreur est survenue. Veuillez réessayer.');
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    // Redirection explicite vers le portail de connexion principal
    window.location.href = 'https://polpo.connexion.l-iamani.com/';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9fc] p-6">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-5 shadow-lg">
        <img className="block mx-auto mb-3 w-44 md:w-56 h-auto" src="/polpo-logo.png" alt="L'IAmani" />
        <h2 className="text-2xl font-bold text-center text-[#163667]">Nouveau mot de passe</h2>
        <p className="text-center text-sm text-gray-500 mt-2">
          Définissez un nouveau mot de passe pour votre compte.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-700 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              placeholder="Nouveau mot de passe"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-700 mb-1">Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              placeholder="Confirmer le mot de passe"
            />
          </div>
          {error && (
            <div className="text-red-700 text-xs text-center">{error}</div>
          )}
          {status && (
            <div className="text-green-700 text-xs text-center">{status}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 border-none rounded-lg bg-[#163667] text-white font-bold cursor-pointer hover:bg-opacity-90 disabled:opacity-60"
          >
            {loading ? 'Enregistrement...' : 'Enregistrer le nouveau mot de passe'}
          </button>
          <button
            type="button"
            onClick={handleBackToLogin}
            className="w-full mt-2 py-2 border border-gray-300 rounded-lg bg-white text-xs text-gray-700 font-semibold hover:bg-gray-50"
          >
            Retour à la connexion
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
