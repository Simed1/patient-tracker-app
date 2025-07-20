/* eslint-disable no-undef */ // Disable no-undef rule for this file to allow __app_id, __firebase_config, Html5QrcodeScanner
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
// Import Html5QrcodeScanner from the global object
const { Html5QrcodeScanner } = window; // Access Html5QrcodeScanner from the global window object

// Ensure these global variables are defined by the environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
// Corrected the variable name from __firebase_firebaseConfig to __firebase_config
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
// Corrected the assignment of initialAuthToken
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Hardcoded initial clinics (similar to your dep.csv for demonstration)
const initialClinics = [
  "1A Oncology", "1B Interv Cath", "1B Peds Endo", "3D BC 2", "6C Postpartum", "6D Postpartum",
  "6E Sleep Lap", "7A Ped NDT", "Adolescent Medicine", "Adult Services", "AH Ostetrics",
  "AH Orthotics", "Allied Health", "Audiology", "C-Section Suite", "Cardiology",
  "Cardic Preadmission Testing", "Case Management", "Child & Adolescent Mental Health",
  "Complex care", "Clinic Radiology", "Dermatology", "Developmental Ped", "Dietician",
  "Endocrinology and Diabetes Clinic", "Diabetes (Educator)", "ENT", "General Ped",
  "Genetics", "GI", "HRIF", "Immunology Allergy", "Infectious Disease", "Interventional Labs",
  "IVF clinic", "Main OR (DSU)", "MRI OPC", "Nephrology", "Neonatology", "Walk-ln",
  "Neonatology Prenatal", "Neurodiagnostic Lab", "Nuclear Medicine", "Neurology",
  "Neurosurgery", "NST clinic", "OB", "OBGYN", "OB Diagnostic Lab", "Ophthalmology",
  "Orthopedics", "OT", "OPCPL Clinic Laboratory", "PAT", "Pediatric Endoscopy Department",
  "General Peds Surgery", "Physiotherapy", "Procedure out of OR", "Plastic & Craniofacial Surgery",
  "Plastics Adults", "Psychiatry", "Pulmonology", "Radiology OBDIAG", "Rehab Medicine",
  "Rheumatology", "Patient'", "Reproductive Medicine", "RM Procedure Room", "SCAP",
  "Social Workers", "Speech Therapy", "Spina Befida clinic", "Ultrasound OPC", "Urology",
  "Urodynamics", "WH Preadmission Testing", "Women Mental health", "Plaza-Radiology", "ED",
  "OB Triage", "1A- Hooc", "1B-DSU", "1B-PACU", "1B -OPIC", "1B - Endoscopy", "1C -WDSU",
  "1C -WPACU", "1D- PAT"
];

// Helper function to format date to YYYY-MM-DD
const formatDateToYYYYMMDD = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper function to format date to MM/DD/YYYY for Firestore string comparison
const formatDateToMMDDYYYY = (date) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month}/${day}/${year}`;
};

// Helper function to format a Date object to "MM/DD/YYYY HH:MM"
const formatDateTimeForFirestore = (dateObj) => {
  if (!dateObj) return '';
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  return `${month}/${day}/${year} ${hours}:${minutes}`;
};

// Helper function to extract "HH:MM" from "MM/DD/YYYY HH:MM"
const extractTimeFromFirestoreFormat = (dateTimeStr) => {
  if (!dateTimeStr) return '';
  const parts = dateTimeStr.split(' ');
  if (parts.length > 1) {
    return parts[1]; // Returns "HH:MM"
  }
  return '';
};

// Helper function to combine YYYY-MM-DD date string and HH:MM time string into a Date object
const combineDateAndTime = (dateYYYYMMDD, timeHHMM) => {
  if (!dateYYYYMMDD || !timeHHMM) return null;
  try {
    // Construct a full datetime string in a parseable format
    const dateTimeString = `${dateYYYYMMDD}T${timeHHMM}:00`; // e.g., "2025-07-19T14:30:00"
    return new Date(dateTimeString);
  } catch (e) {
    console.error("Error combining date and time:", e);
    return null;
  }
};

// Generic Modal Component
const GenericModal = ({ isOpen, onClose, title, children, actions }) => {
  if (!isOpen) return null;

  return (
    <div className="popup fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="popup-content bg-white rounded-lg p-6 shadow-xl w-full max-w-sm relative dark:bg-gray-700 dark:shadow-2xl">
        <span className="close absolute top-2 right-4 text-gray-500 text-3xl font-bold cursor-pointer hover:text-black dark:text-gray-300 dark:hover:text-white" onClick={onClose}>&times;</span>
        <h2 className="text-xl font-semibold mb-4 dark:text-gray-100">{title}</h2>
        {children}
        {actions && (
          <div className="flex justify-end space-x-2 mt-4">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.handler}
                className={`${action.className || 'bg-gray-300 hover:bg-gray-400 text-gray-800'} py-2 px-4 rounded-md dark:bg-gray-500 dark:hover:bg-gray-400 dark:text-gray-100`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


// Main App component
const App = () => {
  const [mrn, setMrn] = useState('');
  const [clinic, setClinic] = useState('');
  const [duration, setDuration] = useState(''); // This will now hold minutes
  const [entryDate, setEntryDate] = useState(formatDateToYYYYMMDD(new Date())); // For Data Entry tab
  const [entries, setEntries] = useState([]);
  const [clinics, setClinics] = useState([]);
  const [db, setDb] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [auth, setAuth] = useState(null); // auth is used implicitly by Firebase functions
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true); // Set to true initially
  const [message, setMessage] = useState(null); // For success/error messages
  const [messageType, setMessageType] = useState(''); // 'success' or 'error'
  const [activeTab, setActiveTab] = useState('dataEntry'); // 'dataEntry', 'clinics', 'dataView', 'search'
  const [darkMode, setDarkMode] = useState(() => {
    // Initialize dark mode from localStorage or default to false
    const savedMode = localStorage.getItem('darkMode');
    return savedMode ? JSON.parse(savedMode) : false;
  });

  // Clinic Management States
  const [newClinicName, setNewClinicName] = useState('');
  const [editingClinicId, setEditingClinicId] = useState(null);
  const [editingClinicName, setNewEditingClinicName] = useState(''); // Renamed for clarity with setter
  const [clinicToDelete, setClinicToDelete] = useState(null);

  // Data View States
  const [selectedViewDate, setSelectedViewDate] = useState(formatDateToYYYYMMDD(new Date()));
  const [dailySummary, setDailySummary] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  // Search States
  const [searchMrn, setSearchMrn] = useState('');
  const [searchClinic, setSearchClinic] = useState('');
  const [searchDate, setSearchDate] = useState(''); // Changed to useState('')
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Patient Update/Delete States
  const [editingPatient, setEditingPatient] = useState(null); // Holds the patient object being edited
  const [patientToDelete, setPatientToDelete] = useState(null); // Holds the patient object to delete

  // QR Scanner States
  const [scanMode, setScanMode] = useState(false);
  const html5QrCodeScannerRef = useRef(null);
  const [cameraError, setCameraError] = useState(null); // State for camera errors

  // Clinic Search State for Data Entry Tab (for filtering dropdown)
  const [clinicSearchQuery, setClinicSearchQuery] = useState('');

  // State to manage which modal is open
  const [currentModal, setCurrentModal] = useState(null); // 'addClinic', 'editClinic', 'deleteClinic', 'editPatient', 'deletePatient', 'deleteAllPatients'


  // Effect to apply dark mode class to HTML element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Function to toggle dark mode
  const toggleDarkMode = () => {
    setDarkMode(prevMode => !prevMode);
  };

  // Function to show a message (success or error)
  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => {
      setMessage(null);
      setMessageType('');
    }, 3000); // Message disappears after 3 seconds
  };

  // Initialize Firebase and set up authentication listener
  useEffect(() => {
    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const firebaseAuth = getAuth(app);

      setDb(firestore);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(firebaseAuth, initialAuthToken);
            } else {
              await signInAnonymously(firebaseAuth);
            }
            // After successful anonymous or custom token sign-in, set userId
            // onAuthStateChanged will trigger again with the new user, so this might be redundant
            // but ensures userId is set if onAuthStateChanged doesn't immediately re-fire for some reason.
            setUserId(firebaseAuth.currentUser?.uid || crypto.randomUUID());
          } catch (authError) {
            console.error("Firebase Auth Error:", authError);
            showMessage("Failed to authenticate. Please try again.", "error");
          }
        }
        setLoading(false); // Set loading to false once auth state is determined
      });

      return () => unsubscribe();
    } catch (initError) {
      console.error("Firebase Initialization Error:", initError);
      showMessage("Failed to initialize Firebase. Check console for details.", "error");
      setLoading(false); // Ensure loading is false even if init fails
    }
  }, []);

  // Fetch Patient Entries from Firestore (for Recent Entries list in Data Entry tab)
  useEffect(() => {
    if (db && userId) {
      const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/patient_entries`);
      const q = query(entriesCollectionRef, orderBy('timestamp', 'desc'));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const fetchedEntries = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setEntries(fetchedEntries);
      }, (err) => {
        console.error("Firestore Patient Entries Fetch Error:", err);
        showMessage("Failed to fetch patient data.", "error");
      });

      return () => unsubscribe();
    }
  }, [db, userId]);

  // Fetch Clinics from Firestore and Seed if empty
  useEffect(() => {
    if (db && userId) {
      const clinicsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/clinics`);
      const q = query(clinicsCollectionRef, orderBy('name', 'asc'));

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const fetchedClinics = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setClinics(fetchedClinics);

        // If no clinics exist, seed the database
        if (fetchedClinics.length === 0) {
          console.log("Seeding initial clinics...");
          for (const clinicName of initialClinics) {
            try {
              await addDoc(clinicsCollectionRef, { name: clinicName });
            } catch (e) {
              console.error("Error seeding clinic:", clinicName, e);
            }
          }
        }
      }, (err) => {
        console.error("Firestore Clinics Fetch Error:", err);
        showMessage("Failed to fetch clinic data.", "error");
      });

      return () => unsubscribe();
    }
  }, [db, userId]);

  // Fetch Daily Summary for Data View Tab
  useEffect(() => {
    if (db && userId && activeTab === 'dataView' && selectedViewDate) {
      setViewLoading(true);
      const formattedViewDate = formatDateToMMDDYYYY(selectedViewDate);
      const entriesCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/patient_entries`);
      const q = query(entriesCollectionRef, where('date', '==', formattedViewDate));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        let dailyEntries = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        dailyEntries.sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return a.timestamp.toDate() - b.timestamp.toDate();
          }
          return 0;
        });

        let totalPatients = new Set();
        let totalDurationMinutesOverall = 0; // Changed to minutes for overall summary

        const clinicsData = {};

        dailyEntries.forEach(entry => {
          totalPatients.add(entry.mrn);
          totalDurationMinutesOverall += entry.time_spent; // Sum the 'time_spent' field (which is in minutes)

          if (!clinicsData[entry.clinic]) {
            clinicsData[entry.clinic] = {
              patients: new Set(),
              totalDurationMinutes: 0, // This will also be in minutes
              entries: []
            };
          }
          clinicsData[entry.clinic].patients.add(entry.mrn);
          clinicsData[entry.clinic].totalDurationMinutes += entry.time_spent; // Sum the 'time_spent' field (minutes)
          clinicsData[entry.clinic].entries.push(entry);
        });

        setDailySummary({
          totalPatients: totalPatients.size,
          totalDurationMinutes: totalDurationMinutesOverall, // Store as minutes
          clinics: Object.keys(clinicsData).map(clinicName => ({
            name: clinicName,
            patientsCount: clinicsData[clinicName].patients.size,
            totalDurationMinutes: clinicsData[clinicName].totalDurationMinutes, // This is in minutes
            entries: clinicsData[clinicName].entries
          })).sort((a, b) => a.name.localeCompare(b.name))
        });
        setViewLoading(false);
      }, (err) => {
        console.error("Firestore Daily Summary Fetch Error:", err);
        showMessage("Failed to fetch daily summary data.", "error");
      });

      return () => unsubscribe();
    } else {
      setDailySummary(null);
    }
  }, [db, userId, activeTab, selectedViewDate]);

  // QR Scanner Logic
  useEffect(() => {
    if (activeTab === 'dataEntry' && scanMode) {
      setCameraError(null); // Clear previous errors
      const html5QrCode = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false // verbose
      );

      const onScanSuccess = (decodedText, decodedResult) => {
        setMrn(decodedText);
        showMessage(`MRN Scanned: ${decodedText}`, 'success');
        html5QrCode.stop().then(() => {
          setScanMode(false);
        }).catch((err) => {
          console.error("Failed to stop scanner:", err);
          showMessage("Failed to stop scanner.", "error");
        });
      };

      const onScanFailure = (error) => {
        // Log detailed error for debugging
        console.error("QR Scan Error:", error);

        // Provide user-friendly feedback based on common error types
        if (error.includes("NotAllowedError") || error.includes("Permission denied")) {
          setCameraError("Camera access denied. Please allow camera permissions in your browser settings for this site.");
        } else if (error.includes("NotFoundError")) {
          setCameraError("No camera found. Please ensure you have a camera connected and enabled.");
        } else if (error.includes("NotReadableError")) {
          setCameraError("Camera is already in use or not accessible. Please close other apps using the camera.");
        } else {
          setCameraError(`Failed to start camera: ${error}. Please try again or check browser settings.`);
        }
      };

      // Start the scanner
      html5QrCode.render(onScanSuccess, onScanFailure);
      html5QrCodeScannerRef.current = html5QrCode; // Store the scanner instance

    } else if (html5QrCodeScannerRef.current) {
      // Stop the scanner if not in scan mode or tab changes
      html5QrCodeScannerRef.current.stop().then(() => {
        console.log("Scanner stopped.");
        setCameraError(null); // Clear error when stopping
      }).catch((err) => {
        console.error("Failed to stop scanner on unmount/tab change:", err);
        setCameraError("Error stopping camera. You might need to refresh the page.");
      });
      html5QrCodeScannerRef.current = null;
    }

    // Cleanup function to stop the scanner when the component unmounts
    return () => {
      if (html5QrCodeScannerRef.current) {
        html5QrCodeScannerRef.current.stop().then(() => {
          console.log("Scanner stopped on component unmount.");
        }).catch((err) => {
          console.error("Failed to stop scanner during cleanup:", err);
        });
      }
    };
  }, [activeTab, scanMode]);


  const handleAddEntry = async () => {
    if (!db || !userId) {
      showMessage("Database not ready. Please wait.", "error");
      return;
    }

    const durationMinutes = parseInt(duration); // Duration is now in minutes

    if (!mrn.trim()) {
      showMessage("Please enter a Medical Record Number (MRN).", "error");
      return;
    }
    if (!clinic.trim()) {
      showMessage("Please select a Clinic.", "error");
      return;
    }
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
      showMessage("Please enter a valid duration in minutes.", "error");
      return;
    }

    const now = new Date();
    const timeInFullStr = formatDateTimeForFirestore(now); // MM/DD/YYYY HH:MM
    const timeOutDt = new Date(now.getTime() + durationMinutes * 60 * 1000); // Add minutes to current time
    const timeOutFullStr = formatDateTimeForFirestore(timeOutDt); // MM/DD/YYYY HH:MM
    const entryDateFormatted = formatDateToMMDDYYYY(now); // MM/DD/YYYY


    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/patient_entries`), {
        mrn: mrn.trim(),
        clinic: clinic.trim(),
        duration: durationMinutes / 60, // Store as hours (float) for 'duration' field
        time_spent: durationMinutes, // Store as minutes (integer) for 'time_spent' field
        date: entryDateFormatted, // Store as MM/DD/YYYY
        time_in: timeInFullStr, // Store as MM/DD/YYYY HH:MM
        time_out: timeOutFullStr, // MM/DD/YYYY HH:MM
        timestamp: serverTimestamp(),
      });
      setMrn('');
      setClinic('');
      setDuration('');
      showMessage("Entry added successfully!", "success");
    } catch (e) {
      console.error("Error adding document: ", e);
      showMessage("Failed to add entry. Please try again.", "error");
    }
  };

  const handleAddClinic = async () => {
    if (!db || !userId) {
      showMessage("Database not ready.", "error");
      return;
    }
    if (!newClinicName.trim()) {
      showMessage("Clinic name cannot be empty.", "error");
      return;
    }
    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/clinics`), { name: newClinicName.trim() });
      setNewClinicName('');
      setCurrentModal(null); // Close modal
      showMessage("Clinic added successfully!", "success");
    } catch (e) {
      console.error("Error adding clinic:", e);
      showMessage("Failed to add clinic.", "error");
    }
  };

  const handleUpdateClinic = async () => {
    if (!db || !userId || !editingClinicId) {
      showMessage("Database not ready or no clinic selected for edit.", "error");
      return;
    }
    if (!editingClinicName.trim()) {
      showMessage("Clinic name cannot be empty.", "error");
      return;
    }
    try {
      const clinicRef = doc(db, `artifacts/${appId}/users/${userId}/clinics`, editingClinicId);
      await updateDoc(clinicRef, { name: editingClinicName.trim() });
      setEditingClinicId(null);
      setNewEditingClinicName(''); // Use the correct setter
      setCurrentModal(null); // Close modal
      showMessage("Clinic updated successfully!", "success");
    } catch (e) {
      console.error("Error updating clinic:", e);
      showMessage("Failed to update clinic.", "error");
    }
  };

  const handleDeleteClinic = async () => {
    if (!db || !userId || !clinicToDelete) {
      showMessage("Database not ready or no clinic selected for delete.", "error");
      return;
    }
    try {
      const patientEntriesRef = collection(db, `artifacts/${appId}/users/${userId}/patient_entries`);
      const allPatientEntriesSnapshot = await new Promise((resolve) => {
        const unsubscribe = onSnapshot(patientEntriesRef, (snapshot) => {
          unsubscribe();
          resolve(snapshot);
        });
      });

      const batch = db.batch();
      allPatientEntriesSnapshot.forEach((docSnap) => {
        if (docSnap.data().clinic === clinicToDelete.name) {
          batch.update(doc(db, `artifacts/${appId}/users/${userId}/patient_entries`, docSnap.id), { clinic: "Other" });
        }
      });
      batch.delete(doc(db, `artifacts/${appId}/users/${userId}/clinics`, clinicToDelete.id));

      await batch.commit();

      setClinicToDelete(null);
      setCurrentModal(null); // Close modal
      showMessage(`Clinic "${clinicToDelete.name}" deleted successfully. Associated patient entries updated to "Other".`, "success");
    } catch (e) {
      console.error("Error deleting clinic:", e);
      showMessage("Failed to delete clinic.", "error");
    }
  };

  const navigateDate = (days) => {
    const currentDate = new Date(selectedViewDate);
    currentDate.setDate(currentDate.getDate() + days);
    setSelectedViewDate(formatDateToYYYYMMDD(currentDate));
  };

  const copyToClipboard = (text) => {
    // Use the older document.execCommand('copy') for better compatibility in iframes
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      showMessage('Copied to clipboard!', 'success');
    } catch (err) {
      console.error('Failed to copy using execCommand:', err);
      showMessage('Failed to copy to clipboard. Please copy manually.', 'error');
    }
    document.body.removeChild(textArea);
  };

  // Handle Search Functionality
  const handleSearch = async () => {
    if (!db || !userId) {
      showMessage("Database not ready. Please wait.", "error");
      return;
    }
    setSearchLoading(true);
    setSearchResults([]); // Clear previous results

    try {
      let q = collection(db, `artifacts/${appId}/users/${userId}/patient_entries`);
      const conditions = [];

      if (searchMrn.trim()) {
        conditions.push(where('mrn', '==', searchMrn.trim()));
      }
      if (searchClinic.trim()) {
        conditions.push(where('clinic', '==', searchClinic.trim()));
      }
      if (searchDate.trim()) {
        conditions.push(where('date', '==', formatDateToMMDDYYYY(searchDate.trim())));
      }

      if (conditions.length > 0) {
          q = query(collection(db, `artifacts/${appId}/users/${userId}/patient_entries`), ...conditions, orderBy('timestamp', 'desc'));
      } else {
          q = query(collection(db, `artifacts/${appId}/users/${userId}/patient_entries`), orderBy('timestamp', 'desc'));
      }

      const querySnapshot = await getDocs(q);
      const fetchedResults = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSearchResults(fetchedResults);
      showMessage("Search completed.", "success");
    } catch (e) {
      console.error("Error searching documents: ", e);
      showMessage("Failed to perform search. Check console for details. You might need to create a Firestore index for this query.", "error");
    } finally {
      setSearchLoading(false);
    }
  };

  // --- Patient Record Management (Update/Delete) ---

  const handleEditPatientClick = (patient) => {
    setEditingPatient({
      ...patient,
      // Ensure date is in YYYY-MM-DD format for the input type="date"
      date: patient.date ? formatDateToYYYYMMDD(new Date(patient.date)) : '',
      // Extract HH:MM for time inputs
      time_in: patient.time_in ? extractTimeFromFirestoreFormat(patient.time_in) : '',
      time_out: patient.time_out ? extractTimeFromFirestoreFormat(patient.time_out) : '',
      // 'duration' in the editingPatient state will now represent minutes for the input field
      duration: patient.time_spent || 0, // Use time_spent directly as duration in minutes
    });
    setCurrentModal('editPatient');
  };

  const handleUpdatePatient = async () => {
    if (!db || !userId || !editingPatient) {
      showMessage("Error: No patient selected for update.", "error");
      return;
    }

    const { id, mrn, clinic, date, time_in, time_out, duration } = editingPatient;

    const updatedMrn = mrn.trim();
    const updatedClinic = clinic.trim();
    let updatedDurationMinutes = parseInt(duration); // Now parsing as minutes from the input
    const updatedDateYYYYMMDD = date; // YYYY-MM-DD
    const updatedTimeInHHMM = time_in; // HH:MM
    const updatedTimeOutHHMM = time_out; // HH:MM

    if (!updatedMrn || !updatedClinic || isNaN(updatedDurationMinutes) || updatedDurationMinutes <= 0) {
      showMessage("Please fill all required fields correctly (MRN, Clinic, Duration in minutes).", "error");
      return;
    }

    let finalTimeInDt = null;
    let finalTimeOutDt = null;
    let finalTimeSpentMinutes = updatedDurationMinutes;
    let finalDurationHours = updatedDurationMinutes / 60;

    const tiDtFromInput = combineDateAndTime(updatedDateYYYYMMDD, updatedTimeInHHMM);
    const toDtFromInput = combineDateAndTime(updatedDateYYYYMMDD, updatedTimeOutHHMM);

    if (tiDtFromInput && toDtFromInput) {
      if (toDtFromInput.getTime() > tiDtFromInput.getTime()) {
        finalTimeInDt = tiDtFromInput;
        finalTimeOutDt = toDtFromInput;
        finalTimeSpentMinutes = Math.round((toDtFromInput.getTime() - tiDtFromInput.getTime()) / (60 * 1000));
        finalDurationHours = finalTimeSpentMinutes / 60;
      } else {
        showMessage("Time Out must be after Time In.", "error");
        return;
      }
    } else if (tiDtFromInput && !isNaN(updatedDurationMinutes)) {
      finalTimeInDt = tiDtFromInput;
      finalTimeSpentMinutes = updatedDurationMinutes;
      finalDurationHours = finalTimeSpentMinutes / 60;
      finalTimeOutDt = new Date(tiDtFromInput.getTime() + finalTimeSpentMinutes * 60 * 1000);
    } else if (toDtFromInput && !isNaN(updatedDurationMinutes)) {
      finalTimeOutDt = toDtFromInput;
      finalTimeSpentMinutes = updatedDurationMinutes;
      finalDurationHours = finalTimeSpentMinutes / 60;
      finalTimeInDt = new Date(toDtFromInput.getTime() - finalTimeSpentMinutes * 60 * 1000);
    } else {
      showMessage("Please provide enough information (Time In/Out or Duration) to calculate times.", "error");
      return;
    }

    try {
      const patientRef = doc(db, `artifacts/${appId}/users/${userId}/patient_entries`, id);
      await updateDoc(patientRef, {
        mrn: updatedMrn,
        clinic: updatedClinic,
        duration: finalDurationHours, // Store as hours (float)
        time_spent: finalTimeSpentMinutes, // Store as minutes (integer)
        date: formatDateToMMDDYYYY(finalTimeInDt || new Date(updatedDateYYYYMMDD)), // Use date from time_in or selected date
        time_in: finalTimeInDt ? formatDateTimeForFirestore(finalTimeInDt) : '',
        time_out: finalTimeOutDt ? formatDateTimeForFirestore(finalTimeOutDt) : '',
      });
      setCurrentModal(null); // Close modal
      setEditingPatient(null);
      showMessage("Patient record updated successfully!", "success");
    } catch (e) {
      console.error("Error updating patient record:", e);
      showMessage("Failed to update patient record.", "error");
    }
  };

  const handleDeletePatientClick = (patient) => {
    setPatientToDelete(patient);
    setCurrentModal('deletePatient');
  };

  const handleDeletePatient = async () => {
    if (!db || !userId || !patientToDelete) {
      showMessage("Error: No patient selected for deletion.", "error");
      return;
    }

    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/patient_entries`, patientToDelete.id));
      setCurrentModal(null); // Close modal
      setPatientToDelete(null);
      showMessage(`Patient record for MRN ${patientToDelete.mrn} deleted successfully.`, "success");
    } catch (e) {
      console.error("Error deleting patient record:", e);
      showMessage("Failed to delete patient record.", "error");
    }
  };

  const handleDeleteAllPatientsClick = () => {
    setCurrentModal('deleteAllPatients');
  };

  const handleDeleteAllPatients = async () => {
    if (!db || !userId) {
      showMessage("Database not ready. Please wait.", "error");
      return;
    }

    try {
      const q = query(collection(db, `artifacts/${appId}/users/${userId}/patient_entries`));
      const querySnapshot = await getDocs(q);
      const batch = db.batch();

      querySnapshot.forEach((docSnapshot) => {
        batch.delete(doc(db, `artifacts/${appId}/users/${userId}/patient_entries`, docSnapshot.id));
      });

      await batch.commit();
      setCurrentModal(null); // Close modal
      showMessage(`All ${querySnapshot.size} records deleted successfully.`, "success");
    } catch (e) {
      console.error("Error deleting all patient records:", e);
      showMessage("Failed to delete all patient records.", "error");
    }
  };

  // Filtered clinics based on search query
  const filteredClinics = clinics.filter(c =>
    c.name.toLowerCase().includes(clinicSearchQuery.toLowerCase())
  );


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#f5f7fa] to-[#c3cfe2] dark:from-gray-800 dark:to-gray-900">
        <p className="text-lg text-gray-700 dark:text-gray-300">Loading application...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f7fa] to-[#c3cfe2] text-[#333] font-[Poppins,sans-serif] dark:from-gray-800 dark:to-gray-900 dark:text-gray-100">
      <nav className="bg-gradient-to-br from-[#007bff] to-[#0056b3] py-2 px-20 shadow-lg md:px-4 dark:from-gray-900 dark:to-gray-700">
        <ul className="list-none m-0 p-0 flex justify-between items-center max-w-screen-xl mx-auto flex-wrap md:flex-nowrap md:overflow-x-auto">
          <li>
            <button
              className={`text-white text-lg font-medium py-2 px-4 rounded-md transition-all duration-300 ease-in-out whitespace-nowrap
                ${activeTab === 'dataEntry' ? 'bg-white bg-opacity-10' : 'hover:bg-white hover:bg-opacity-10 hover:translate-y-[-2px]'}`}
              onClick={() => setActiveTab('dataEntry')}
            >
              Data Entry
            </button>
          </li>
          <li>
            <button
              className={`text-white text-lg font-medium py-2 px-4 rounded-md transition-all duration-300 ease-in-out whitespace-nowrap
                ${activeTab === 'dataView' ? 'bg-white bg-opacity-10' : 'hover:bg-white hover:bg-opacity-10 hover:translate-y-[-2px]'}`}
              onClick={() => setActiveTab('dataView')}
            >
              Data View
            </button>
          </li>
          <li>
            <button
              className={`text-white text-lg font-medium py-2 px-4 rounded-md transition-all duration-300 ease-in-out whitespace-nowrap
                ${activeTab === 'search' ? 'bg-white bg-opacity-10' : 'hover:bg-white hover:bg-opacity-10 hover:translate-y-[-2px]'}`}
              onClick={() => setActiveTab('search')}
            >
              Search
            </button>
          </li>
          <li>
            <button
              className={`text-white text-lg font-medium py-2 px-4 rounded-md transition-all duration-300 ease-in-out whitespace-nowrap
                ${activeTab === 'clinics' ? 'bg-white bg-opacity-10' : 'hover:bg-white hover:bg-opacity-10 hover:translate-y-[-2px]'}`}
              onClick={() => setActiveTab('clinics')}
            >
              Clinics
            </button>
          </li>
          <li>
            <button
              className="text-white text-lg font-medium py-2 px-4 rounded-md transition-all duration-300 ease-in-out whitespace-nowrap hover:bg-white hover:bg-opacity-10 hover:translate-y-[-2px]"
              onClick={toggleDarkMode}
            >
              {darkMode ? 'Light Mode' : 'Dark Mode'}
            </button>
          </li>
        </ul>
      </nav>

      <div className="container max-w-screen-xl mx-auto my-5 p-5 bg-white rounded-xl shadow-xl dark:bg-gray-700 dark:shadow-2xl">
        <h1 className="text-center text-[#007bff] font-semibold mb-5 text-3xl dark:text-blue-300">
          Patient Coverage Tracker
        </h1>

        {message && (
          <div className={`px-4 py-3 rounded-md relative mb-4 ${messageType === 'success' ? 'bg-green-100 border border-green-400 text-green-700 dark:bg-green-700 dark:border-green-600 dark:text-green-100' : 'bg-red-100 border border-red-400 text-red-700 dark:bg-red-700 dark:border-red-600 dark:text-red-100'}`}>
            <span className="block sm:inline">{message}</span>
          </div>
        )}

        {userId && (
          <div className="text-sm text-gray-600 text-center mb-4 break-words dark:text-gray-300">
            Your User ID: <span className="font-semibold">{userId}</span>
          </div>
        )}

        {/* Data Entry Tab Content */}
        {activeTab === 'dataEntry' && (
          <>
            <div className="form-container max-w-md mx-auto p-5 bg-white rounded-xl shadow-xl dark:bg-gray-600 dark:shadow-2xl">
              <div className="qr-scanner mb-5 rounded-lg overflow-hidden">
                {scanMode && !cameraError && (
                  <p className="text-center text-gray-600 dark:text-gray-300 mb-2">Loading camera...</p>
                )}
                <div id="reader" style={{ width: '100%' }}></div>
                {cameraError && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mt-4 dark:bg-red-700 dark:border-red-600 dark:text-red-100">
                    <p className="font-bold">Camera Error:</p>
                    <p>{cameraError}</p>
                    {cameraError.includes("denied") && (
                      <p className="mt-2 text-sm">
                        To enable camera: Go to your phone's browser settings (e.g., Chrome, Safari) &gt; Site Settings / Permissions &gt; Camera &gt; Allow for this website.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setScanMode(!scanMode)}
                className="w-full bg-gradient-to-br from-purple-500 to-purple-600 text-white py-3 px-4 rounded-lg font-bold transition-all duration-300 ease-in-out hover:translate-y-[-2px] hover:shadow-lg mb-5 dark:from-purple-700 dark:to-purple-800 dark:hover:from-purple-800 dark:hover:to-purple-900"
              >
                {scanMode ? 'Stop Scan' : 'Start Scan (Scan MRN)'}
              </button>

              <button
                onClick={handleAddEntry}
                disabled={loading} // Disable button while loading
                className={`w-full bg-gradient-to-br from-[#007bff] to-[#0056b3] text-white py-3 px-4 rounded-lg font-bold transition-all duration-300 ease-in-out hover:translate-y-[-2px] hover:shadow-lg mb-5 dark:from-blue-700 dark:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Add Entry
              </button>
              <div className="form-group mb-5">
                <label htmlFor="entryDate" className="block font-medium mb-2 text-[#555] dark:text-gray-200">
                  Date
                </label>
                <input
                  type="date"
                  id="entryDate"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  disabled={loading} // Disable input while loading
                  className={`w-full p-2 text-sm border border-[#ddd] rounded-lg bg-[#f9f9f9] transition-all duration-300 ease-in-out focus:border-[#007bff] focus:shadow-[0_0_0_3px_rgba(0,123,255,0.2)] outline-none dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100 dark:focus:border-blue-400 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>
              <div className="form-group mb-5">
                <label htmlFor="mrn" className="block font-medium mb-2 text-[#555] dark:text-gray-200">
                  Medical Record Number (MRN)
                </label>
                <input
                  type="text"
                  id="mrn"
                  value={mrn}
                  onChange={(e) => setMrn(e.target.value)}
                  placeholder="e.g., 123456"
                  readOnly={scanMode || loading} // Make MRN read-only when scanning or loading
                  disabled={loading} // Disable input while loading
                  className={`w-full p-2 text-sm border border-[#ddd] rounded-lg bg-[#f9f9f9] transition-all duration-300 ease-in-out focus:border-[#007bff] focus:shadow-[0_0_0_3px_rgba(0,123,255,0.2)] outline-none dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100 dark:focus:border-blue-400 ${scanMode || loading ? 'bg-gray-200 cursor-not-allowed dark:bg-gray-600' : ''}`}
                />
              </div>
              <div className="form-group mb-5">
                <label htmlFor="clinicFilter" className="block font-medium mb-2 text-[#555] dark:text-gray-200">
                  Type to filter and select clinic
                </label>
                <input
                  type="text"
                  id="clinicFilter"
                  value={clinicSearchQuery}
                  onChange={(e) => setClinicSearchQuery(e.target.value)}
                  placeholder="Start typing clinic name..."
                  disabled={loading} // Disable input while loading
                  className={`w-full p-2 text-sm border border-[#ddd] rounded-lg bg-[#f9f9f9] transition-all duration-300 ease-in-out focus:border-[#007bff] focus:shadow-[0_0_0_3px_rgba(0,123,255,0.2)] outline-none dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100 dark:focus:border-blue-400 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>
              <div className="form-group mb-5">
                <label htmlFor="clinic" className="block font-medium mb-2 text-[#555] dark:text-gray-200">
                  Select Clinic
                </label>
                <select
                  id="clinic"
                  value={clinic}
                  onChange={(e) => setClinic(e.target.value)}
                  disabled={loading} // Disable input while loading
                  className={`w-full p-2 text-sm border border-[#ddd] rounded-lg bg-[#f9f9f9] transition-all duration-300 ease-in-out focus:border-[#007bff] focus:shadow-[0_0_0_3px_rgba(0,123,255,0.2)] outline-none appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns=\'http://www.w3.org/2000/svg\'%20viewBox=\'0%200%2024%2024\'%20fill=\'%23007bff\'%3e%3cpath%20d=\'M7%2010l5%205%205-5z\'/%3e%3c/svg%3e')] bg-no-repeat bg-[right_10px_center] bg-[length:12px] dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100 dark:focus:border-blue-400 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">Select a Clinic</option>
                  {filteredClinics.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group mb-5">
                <label htmlFor="duration" className="block font-medium mb-2 text-[#555] dark:text-gray-200">
                  Duration (in minutes, e.g., 90)
                </label>
                <input
                  type="number"
                  id="duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="e.g., 90"
                  disabled={loading} // Disable input while loading
                  className={`w-full p-2 text-sm border border-[#ddd] rounded-lg bg-[#f9f9f9] transition-all duration-300 ease-in-out focus:border-[#007bff] focus:shadow-[0_0_0_3px_rgba(0,123,255,0.2)] outline-none dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100 dark:focus:border-blue-400 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  min="1" // Minimum duration of 1 minute
                />
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center dark:text-gray-100">Recent Entries</h2>
            {entries.length === 0 ? (
              <p className="no-records text-center mt-5 text-gray-500 dark:text-gray-400">No entries yet. Add your first entry above!</p>
            ) : (
              <div className="overflow-x-auto rounded-lg shadow-md">
                <table className="w-full border-collapse">
                  <thead className="bg-indigo-500 text-white dark:bg-gray-800">
                    <tr>
                      <th className="p-2 text-left text-sm font-medium rounded-tl-lg">Date</th>
                      <th className="p-2 text-left text-sm font-medium">MRN</th>
                      <th className="p-2 text-left text-sm font-medium">Clinic</th>
                      <th className="p-2 text-left text-sm font-medium">Duration (min)</th>
                      <th className="p-2 text-left text-sm font-medium">Time In</th>
                      <th className="p-2 text-left text-sm font-medium rounded-tr-lg">Time Out</th>
                      <th className="p-2 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-600">
                        <td className="p-2 text-gray-800 text-sm dark:text-gray-200">
                          {entry.date}
                        </td>
                        <td className="p-2 text-gray-800 text-sm cursor-pointer hover:underline dark:text-gray-200" onClick={() => copyToClipboard(entry.mrn)}>
                          {entry.mrn}
                        </td>
                        <td className="p-2 text-gray-800 text-sm dark:text-gray-200">{entry.time_spent}</td>
                        <td className="p-2 text-gray-800 text-sm cursor-pointer hover:underline dark:text-gray-200" onClick={() => copyToClipboard(extractTimeFromFirestoreFormat(entry.time_in))}>
                          {extractTimeFromFirestoreFormat(entry.time_in)}
                        </td>
                        <td className="p-2 text-gray-800 text-sm cursor-pointer hover:underline dark:text-gray-200" onClick={() => copyToClipboard(extractTimeFromFirestoreFormat(entry.time_out))}>
                          {extractTimeFromFirestoreFormat(entry.time_out)}
                        </td>
                        <td className="p-2 text-gray-800 text-sm flex space-x-2">
                          <button
                            onClick={() => handleEditPatientClick(entry)}
                            className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-1 px-3 rounded-md text-xs transition-all duration-300 ease-in-out hover:translate-y-[-1px] hover:shadow-md dark:from-blue-700 dark:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePatientClick(entry)}
                            className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-1 px-3 rounded-md text-xs transition-all duration-300 ease-in-out hover:translate-y-[-1px] hover:shadow-md dark:from-red-700 dark:to-red-800 dark:hover:from-red-800 dark:hover:to-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-center mt-6">
              <button
                onClick={handleDeleteAllPatientsClick}
                className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:scale-105 dark:from-red-700 dark:to-red-800 dark:hover:from-red-800 dark:hover:to-red-900"
              >
                Delete All Records
              </button>
            </div>
          </>
        )}

        {/* Data View Tab Content */}
        {activeTab === 'dataView' && (
          <>
            <div className="flex items-center justify-center space-x-2 mb-6">
              <button
                onClick={() => navigateDate(-1)}
                className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-md
                disabled:bg-[#b0c4de] disabled:text-[#f1f1f1] disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none disabled:hover:translate-y-0
                dark:bg-gray-800 dark:hover:bg-gray-900 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
              >
                &#9664;
              </button>
              <input
                type="date"
                value={selectedViewDate}
                onChange={(e) => setSelectedViewDate(e.target.value)}
                className="p-2 border rounded-md dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100"
              />
              <button
                onClick={() => navigateDate(1)}
                className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-md
                disabled:bg-[#b0c4de] disabled:text-[#f1f1f1] disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none disabled:hover:translate-y-0
                dark:bg-gray-800 dark:hover:bg-gray-900 dark:disabled:bg-gray-600 dark:disabled:text-gray-400"
              >
                &#9654;
              </button>
            </div>

            {viewLoading ? (
              <p className="text-center text-gray-600 dark:text-gray-300">Loading daily summary...</p>
            ) : dailySummary && (dailySummary.totalPatients > 0 || dailySummary.totalDurationMinutes > 0) ? (
              <>
                <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-md mb-6 text-center dark:bg-blue-700 dark:border-blue-600 dark:text-blue-100">
                  <h3 className="font-bold text-lg mb-2">Summary for {formatDateToMMDDYYYY(selectedViewDate)}</h3>
                  <p
                    className="flex justify-center items-center gap-2 mb-3" // Use flexbox for spacing
                  >
                    <span
                      className="cursor-pointer bg-blue-500 text-white py-2 px-4 rounded-lg font-bold text-2xl dark:bg-blue-800" // Added text-2xl
                      onClick={() => copyToClipboard(`${dailySummary.totalPatients} Patients, ${dailySummary.totalDurationMinutes} minutes`)}
                    >
                      {dailySummary.totalPatients} Patients, {dailySummary.totalDurationMinutes} minutes
                    </span>
                  </p>
                  <button
                    onClick={() => copyToClipboard(`${dailySummary.totalPatients} Patients, ${dailySummary.totalDurationMinutes} minutes`)}
                    className="mt-3 bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md text-sm dark:bg-blue-800 dark:hover:bg-blue-900"
                  >
                    Copy Summary
                  </button>
                </div>

                {dailySummary.clinics.map((clinicData) => (
                  <div key={clinicData.name} className="bg-white rounded-lg shadow-md p-4 mb-4 dark:bg-gray-600 dark:shadow-2xl">
                    <h3 className="text-xl font-bold text-gray-800 mb-2 dark:text-gray-100"> {/* Increased font size and bold */}
                      {clinicData.name}: {clinicData.totalDurationMinutes} minutes ({clinicData.patientsCount} patients)
                    </h3>
                    <button
                      onClick={() => copyToClipboard(`${clinicData.name}: ${clinicData.totalDurationMinutes} minutes (${clinicData.patientsCount} patients)`)}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-1 px-3 rounded-md text-xs mb-2 dark:bg-gray-500 dark:hover:bg-gray-400 dark:text-gray-100"
                    >
                      Copy Clinic Summary
                    </button>
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white border border-gray-200 dark:bg-gray-700 dark:border-gray-500">
                        <thead className="bg-gray-100 dark:bg-gray-800">
                          <tr>
                            <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">MRN</th>
                            <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Duration (min)</th>
                            <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Time In</th>
                            <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Time Out</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clinicData.entries.map((entry) => (
                            <tr key={entry.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-600">
                              <td className="p-2 text-gray-700 text-sm cursor-pointer hover:underline dark:text-gray-200" onClick={() => copyToClipboard(entry.mrn)}>{entry.mrn}</td>
                              <td className="p-2 text-gray-700 text-sm dark:text-gray-200">{entry.time_spent}</td>
                              <td className="p-2 text-gray-700 text-sm cursor-pointer hover:underline dark:text-gray-200" onClick={() => copyToClipboard(extractTimeFromFirestoreFormat(entry.time_in))}>{extractTimeFromFirestoreFormat(entry.time_in)}</td>
                              <td className="p-2 text-gray-700 text-sm cursor-pointer hover:underline dark:text-gray-200" onClick={() => copyToClipboard(extractTimeFromFirestoreFormat(entry.time_out))}>{extractTimeFromFirestoreFormat(entry.time_out)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="no-records text-center mt-5 text-gray-600 dark:text-gray-300">No data available for {formatDateToMMDDYYYY(selectedViewDate)}.</p>
            )}
          </>
        )}

        {/* Search Tab Content */}
        {activeTab === 'search' && (
          <>
            <div className="form-container max-w-md mx-auto p-5 bg-white rounded-xl shadow-xl dark:bg-gray-600 dark:shadow-2xl mb-8">
              <div className="form-group mb-5">
                <label htmlFor="searchMrn" className="block font-medium mb-2 text-[#555] dark:text-gray-200">
                  Search by MRN
                </label>
                <input
                  type="text"
                  id="searchMrn"
                  value={searchMrn}
                  onChange={(e) => setSearchMrn(e.target.value)}
                  placeholder="Enter MRN"
                  className="w-full p-2 text-sm border border-[#ddd] rounded-lg bg-[#f9f9f9] transition-all duration-300 ease-in-out focus:border-[#007bff] focus:shadow-[0_0_0_3px_rgba(0,123,255,0.2)] outline-none dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100 dark:focus:border-blue-400"
                />
              </div>
              <div className="form-group mb-5">
                <label htmlFor="searchClinic" className="block font-medium mb-2 text-[#555] dark:text-gray-200">
                  Search by Clinic
                </label>
                <select
                  id="searchClinic"
                  value={searchClinic}
                  onChange={(e) => setSearchClinic(e.target.value)}
                  className="w-full p-2 text-sm border border-[#ddd] rounded-lg bg-[#f9f9f9] transition-all duration-300 ease-in-out focus:border-[#007bff] focus:shadow-[0_0_0_3px_rgba(0,123,255,0.2)] outline-none appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns=\'http://www.w3.org/2000/svg\'%20viewBox=\'0%200%2024%2024\'%20fill=\'%23007bff\'%3e%3cpath%20d=\'M7%2010l5%205%205-5z\'/%3e%3c/svg%3e')] bg-no-repeat bg-[right_10px_center] bg-[length:12px] dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100 dark:focus:border-blue-400"
                >
                  <option value="">Select a Clinic</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group mb-5">
                <label htmlFor="searchDate" className="block font-medium mb-2 text-[#555] dark:text-gray-200">
                  Search by Date
                </label>
                <input
                  type="date"
                  id="searchDate"
                  value={searchDate}
                  onChange={(e) => setSearchDate(e.target.value)}
                  className="w-full p-2 text-sm border border-[#ddd] rounded-lg bg-[#f9f9f9] transition-all duration-300 ease-in-out focus:border-[#007bff] focus:shadow-[0_0_0_3px_rgba(0,123,255,0.2)] outline-none dark:bg-gray-700 dark:border-gray-500 dark:text-gray-100 dark:focus:border-blue-400"
                />
              </div>
              <button
                onClick={handleSearch}
                className="w-full bg-gradient-to-br from-[#007bff] to-[#0056b3] text-white py-3 px-4 rounded-lg font-bold transition-all duration-300 ease-in-out hover:translate-y-[-2px] hover:shadow-lg dark:from-blue-700 dark:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900"
              >
                Search
              </button>
            </div>

            <h2 className="text-2xl font-semibold text-gray-800 mb-4 text-center dark:text-gray-100">Search Results</h2>
            {searchLoading ? (
              <p className="text-center text-gray-600 dark:text-gray-300">Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className="no-records text-center mt-5 text-gray-500 dark:text-gray-400">No results found. Try a different search.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg shadow-md">
                <table className="w-full border-collapse">
                  <thead className="bg-indigo-500 text-white dark:bg-gray-800">
                    <tr>
                      <th className="p-2 text-left text-sm font-medium rounded-tl-lg">Date</th>
                      <th className="p-2 text-left text-sm font-medium">MRN</th>
                      <th className="p-2 text-left text-sm font-medium">Clinic</th>
                      <th className="p-2 text-left text-sm font-medium">Duration (min)</th>
                      <th className="p-2 text-left text-sm font-medium">Time In</th>
                      <th className="p-2 text-left text-sm font-medium">Time Out</th>
                      <th className="p-2 text-left text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((entry) => (
                      <tr key={entry.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-600">
                        <td className="p-2 text-gray-800 text-sm dark:text-gray-200">
                          {entry.date}
                        </td>
                        <td className="p-2 text-gray-800 text-sm cursor-pointer hover:underline dark:text-gray-200" onClick={() => copyToClipboard(entry.mrn)}>
                          {entry.mrn}
                        </td>
                        <td className="p-2 text-gray-800 text-sm dark:text-gray-200">{entry.clinic}</td>
                        <td className="p-2 text-gray-800 text-sm dark:text-gray-200">{entry.time_spent}</td>
                        <td className="p-2 text-gray-800 text-sm cursor-pointer hover:underline dark:text-gray-200" onClick={() => copyToClipboard(extractTimeFromFirestoreFormat(entry.time_in))}>
                          {extractTimeFromFirestoreFormat(entry.time_in)}
                        </td>
                        <td className="p-2 text-gray-800 text-sm cursor-pointer hover:underline dark:text-gray-200" onClick={() => copyToClipboard(extractTimeFromFirestoreFormat(entry.time_out))}>
                          {extractTimeFromFirestoreFormat(entry.time_out)}
                        </td>
                        <td className="p-2 text-gray-800 text-sm flex space-x-2">
                          <button
                            onClick={() => handleEditPatientClick(entry)}
                            className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-1 px-3 rounded-md text-xs transition-all duration-300 ease-in-out hover:translate-y-[-1px] hover:shadow-md dark:from-blue-700 dark:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeletePatientClick(entry)}
                            className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-1 px-3 rounded-md text-xs transition-all duration-300 ease-in-out hover:translate-y-[-1px] hover:shadow-md dark:from-red-700 dark:to-red-800 dark:hover:from-red-800 dark:hover:to-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-center mt-6">
              <button
                onClick={handleDeleteAllPatientsClick}
                className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:scale-105 dark:from-red-700 dark:to-red-800 dark:hover:from-red-800 dark:hover:to-red-900"
              >
                Delete All Records
              </button>
            </div>
          </>
        )}


        {/* Clinics Tab Content */}
        {activeTab === 'clinics' && (
          <>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setCurrentModal('addClinic')}
                className="bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-300 ease-in-out transform hover:scale-105 dark:from-green-700 dark:to-green-800 dark:hover:from-green-800 dark:hover:to-green-900"
              >
                Add New Clinic
              </button>
            </div>

            {clinics.length === 0 ? (
              <p className="no-records text-center mt-5 text-gray-500 dark:text-gray-400">No clinics defined. Add some above!</p>
            ) : (
              <div className="overflow-x-auto rounded-lg shadow-md">
                <table className="w-full border-collapse">
                  <thead className="bg-indigo-500 text-white dark:bg-gray-800">
                    <tr>
                      <th className="p-2 text-left text-sm font-medium rounded-tl-lg">Clinic Name</th>
                      <th className="p-2 text-left text-sm font-medium rounded-tr-lg">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clinics.map((c) => (
                      <tr key={c.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-600">
                        <td className="p-2 text-gray-800 text-sm dark:text-gray-200">{c.name}</td>
                        <td className="p-2 text-gray-800 text-sm flex space-x-2">
                          <button
                            onClick={() => {
                              setEditingClinicId(c.id);
                              setNewEditingClinicName(c.name); // Use the correct setter
                              setCurrentModal('editClinic');
                            }}
                            className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white py-1 px-3 rounded-md text-xs transition-all duration-300 ease-in-out hover:translate-y-[-1px] hover:shadow-md dark:from-blue-700 dark:to-blue-800 dark:hover:from-blue-800 dark:hover:to-blue-900"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setClinicToDelete(c);
                              setCurrentModal('deleteClinic');
                            }}
                            className="bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white py-1 px-3 rounded-md text-xs transition-all duration-300 ease-in-out hover:translate-y-[-1px] hover:shadow-md dark:from-red-700 dark:to-red-800 dark:hover:from-red-800 dark:hover:to-red-900"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <GenericModal
        isOpen={currentModal === 'addClinic'}
        onClose={() => setCurrentModal(null)}
        title="Add New Clinic"
        actions={[
          { label: 'Cancel', handler: () => setCurrentModal(null) },
          { label: 'Add Clinic', handler: handleAddClinic, className: 'bg-gradient-to-br from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white' }
        ]}
      >
        <input
          type="text"
          value={newClinicName}
          onChange={(e) => setNewClinicName(e.target.value)}
          placeholder="Enter clinic name"
          className="w-full p-2 border border-gray-300 rounded-md mb-4 dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100"
        />
      </GenericModal>

      <GenericModal
        isOpen={currentModal === 'editClinic'}
        onClose={() => setCurrentModal(null)}
        title="Edit Clinic"
        actions={[
          { label: 'Cancel', handler: () => setCurrentModal(null) },
          { label: 'Save Changes', handler: handleUpdateClinic, className: 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white' }
        ]}
      >
        <input
          type="text"
          value={editingClinicName}
          onChange={(e) => setNewEditingClinicName(e.target.value)} // Use the correct setter
          placeholder="Enter new clinic name"
          className="w-full p-2 border border-gray-300 rounded-md mb-4 dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100"
        />
      </GenericModal>

      <GenericModal
        isOpen={currentModal === 'deleteClinic'}
        onClose={() => setCurrentModal(null)}
        title="Confirm Delete"
        actions={[
          { label: 'Cancel', handler: () => setCurrentModal(null) },
          { label: 'Delete', handler: handleDeleteClinic, className: 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white' }
        ]}
      >
        <p className="mb-4 dark:text-gray-200">
          Are you sure you want to delete clinic "
          <span className="font-bold">{clinicToDelete?.name}</span>"?
          All patient entries associated with this clinic will be updated to "Other".
        </p>
      </GenericModal>

      <GenericModal
        isOpen={currentModal === 'editPatient'}
        onClose={() => setCurrentModal(null)}
        title="Edit Patient Record"
        actions={[
          { label: 'Cancel', handler: () => setCurrentModal(null) },
          { label: 'Save Changes', handler: handleUpdatePatient, className: 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white' }
        ]}
      >
        {editingPatient && (
          <>
            <div className="form-group mb-4">
              <label htmlFor="editMrn" className="block font-medium mb-2 text-[#555] dark:text-gray-200">MRN</label>
              <input
                type="text"
                id="editMrn"
                value={editingPatient.mrn}
                onChange={(e) => setEditingPatient({ ...editingPatient, mrn: e.target.value })}
                className="w-full p-2 text-sm border border-[#ddd] rounded-lg dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100"
              />
            </div>
            <div className="form-group mb-4">
              <label htmlFor="editClinic" className="block font-medium mb-2 text-[#555] dark:text-gray-200">Clinic</label>
              <select
                id="editClinic"
                value={editingPatient.clinic}
                onChange={(e) => setEditingPatient({ ...editingPatient, clinic: e.target.value })}
                className="w-full p-2 text-sm border border-[#ddd] rounded-lg appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns=\'http://www.w3.org/2000/svg\'%20viewBox=\'0%200%2024%2024\'%20fill=\'%23007bff\'%3e%3cpath%20d=\'M7%2010l5%205%205-5z\'/%3e%3c/svg%3e')] bg-no-repeat bg-[right_10px_center] bg-[length:12px] dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100"
              >
                <option value="">Select a Clinic</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group mb-4">
              <label htmlFor="editDuration" className="block font-medium mb-2 text-[#555] dark:text-gray-200">Duration (in minutes)</label>
              <input
                type="number"
                id="editDuration"
                value={editingPatient.duration} // This is now minutes
                onChange={(e) => setEditingPatient({ ...editingPatient, duration: e.target.value })}
                min="1"
                className="w-full p-2 text-sm border border-[#ddd] rounded-lg dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100"
              />
            </div>
            <div className="form-group mb-4">
              <label htmlFor="editDate" className="block font-medium mb-2 text-[#555] dark:text-gray-200">Date</label>
              <input
                type="date"
                id="editDate"
                value={editingPatient.date}
                onChange={(e) => setEditingPatient({ ...editingPatient, date: e.target.value })}
                className="w-full p-2 text-sm border border-[#ddd] rounded-lg dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100"
              />
            </div>
            <div className="form-group mb-4">
              <label htmlFor="editTimeIn" className="block font-medium mb-2 text-[#555] dark:text-gray-200">Time In (HH:MM)</label>
              <input
                type="time"
                id="editTimeIn"
                value={editingPatient.time_in}
                onChange={(e) => setEditingPatient({ ...editingPatient, time_in: e.target.value })}
                className="w-full p-2 text-sm border border-[#ddd] rounded-lg dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100"
              />
            </div>
            <div className="form-group mb-4">
              <label htmlFor="editTimeOut" className="block font-medium mb-2 text-[#555] dark:text-gray-200">Time Out (HH:MM)</label>
              <input
                type="time"
                id="editTimeOut"
                value={editingPatient.time_out}
                onChange={(e) => setEditingPatient({ ...editingPatient, time_out: e.target.value })}
                className="w-full p-2 text-sm border border-[#ddd] rounded-lg dark:bg-gray-800 dark:border-gray-500 dark:text-gray-100"
              />
            </div>
          </>
        )}
      </GenericModal>

      <GenericModal
        isOpen={currentModal === 'deletePatient'}
        onClose={() => setCurrentModal(null)}
        title="Confirm Deletion"
        actions={[
          { label: 'Cancel', handler: () => setCurrentModal(null) },
          { label: 'Delete', handler: handleDeletePatient, className: 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white' }
        ]}
      >
        <p className="mb-4 dark:text-gray-200">
          Are you sure you want to delete the record for MRN "
          <span className="font-bold">{patientToDelete?.mrn}</span>" from Clinic "
          <span className="font-bold">{patientToDelete?.clinic}</span>"?
        </p>
      </GenericModal>

      <GenericModal
        isOpen={currentModal === 'deleteAllPatients'}
        onClose={() => setCurrentModal(null)}
        title="Confirm Delete All Records"
        actions={[
          { label: 'Cancel', handler: () => setCurrentModal(null) },
          { label: 'Delete All', handler: handleDeleteAllPatients, className: 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white' }
        ]}
      >
        <p className="mb-4 dark:text-gray-200">
          <span className="font-bold text-red-600">WARNING:</span> This action will permanently delete ALL patient records. This cannot be undone. Are you absolutely sure you want to proceed?
        </p>
      </GenericModal>
    </div>
  );
};

export default App;