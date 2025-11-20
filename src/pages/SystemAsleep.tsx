import { Clock } from 'lucide-react';

const SystemAsleep = () => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="text-center">
        <Clock className="mx-auto h-16 w-16 text-muted-foreground" />
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground">
          System is Currently Asleep
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          The application is temporarily unavailable. Please try again later.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          If you are an administrator, you can still access the system to wake it up.
        </p>
      </div>
    </div>
  );
};

export default SystemAsleep;