import { serviceFeatures } from "../constants";

const ServiceSection = () => {
  return (
    <section className="w-full bg-white py-[60px] px-4 md:px-8">
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        {/* Título de la sección */}
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-center mb-16 max-w-3xl">
          <span className="text-[#f97316]">Lo que tu negocio necesita,</span>{" "}
          <span className="text-[#1a1a1a]">cuando lo necesita.</span>
        </h2>

        {/* Grid de servicios */}
        <ul className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 list-none p-0 m-0">
          {serviceFeatures.map((service) => (
            <li key={service.id} className="flex flex-col items-center text-center">
              {/* Icono */}
              <div className="flex justify-center items-center w-[70px] h-[70px] mb-6 text-[#f97316]">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-full h-full"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={service.iconPath} />
                </svg>
              </div>

              {/* Textos */}
              <h3 className="text-xl font-bold text-[#1a1a1a] mb-3">
                {service.title}
              </h3>
              <p className="text-gray-500 text-sm md:text-base leading-relaxed max-w-[280px]">
                {service.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default ServiceSection;
