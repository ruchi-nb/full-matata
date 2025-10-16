import InvertedGradientButton from "@/components/common/InvertedGradientButton";
export default function SettingsHeader({ isEditing, setIsEditing, onSave, onCancel }) {
  
  const handleEditClick = () => {
    setIsEditing(true);
  };

  return (
    <div className="flex justify-between items-center mb-8 bg-gradient-to-r from-[#3d85c6] to-[#004dd6] hover:from-[#003cb3] p-4 rounded-2xl">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-blue-100">Manage your profile and preferences</p>
      </div>
      
      {!isEditing ? (
        <InvertedGradientButton
          onClick={handleEditClick}
          color="amber"
        >
          Edit Profile
        </InvertedGradientButton>
      ) : (
        <div className="flex space-x-3">
          <InvertedGradientButton 
            onClick={onCancel}
            color="red"
          >
            Cancel
          </InvertedGradientButton>
          <InvertedGradientButton 
            onClick={onSave}
            color="amber"
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
              className="lucide lucide-save h-4 w-4 mr-2" 
              aria-hidden="true"
            >
              <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"></path>
              <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"></path>
              <path d="M7 3v4a1 1 0 0 0 1 1h7"></path>
            </svg>
            Save Changes
          </InvertedGradientButton>
        </div>
      )}
    </div>
  );
}