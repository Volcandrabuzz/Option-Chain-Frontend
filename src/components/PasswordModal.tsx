import React, { useState } from "react";

interface Props {
  onSuccess: () => void;
}

const PasswordModal: React.FC<Props> = ({ onSuccess }) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const correctPassword = import.meta.env.VITE_APP_PASSWORD;

  const handleSubmit = () => {
    if (password === correctPassword) {
      localStorage.setItem("auth_ok", "true");
      onSuccess();
    } else {
      setError("Incorrect password");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[9999]">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[320px]">
        <h2 className="text-xl font-bold text-white mb-4 text-center">
          🔐 Enter Password
        </h2>

        <input
          type="password"
          className="w-full px-3 py-2 rounded bg-gray-800 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />

        {error && (
          <p className="text-red-400 text-sm mt-2 text-center">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold"
        >
          Unlock
        </button>
      </div>
    </div>
  );
};

export default PasswordModal;
