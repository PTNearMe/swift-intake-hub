import { useSearchParams } from "react-router-dom";

const IntakeForms = () => {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("patientId");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-foreground">Medical Forms</h1>
        <p className="text-xl text-muted-foreground mb-4">
          Patient ID: {patientId}
        </p>
        <p className="text-lg text-muted-foreground">Coming Soon...</p>
      </div>
    </div>
  );
};

export default IntakeForms;